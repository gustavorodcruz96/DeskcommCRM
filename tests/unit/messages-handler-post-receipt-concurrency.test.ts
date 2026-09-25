import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import type { HandlerCtx } from "@/lib/api/handlers/types";

const mocks = vi.hoisted(() => ({ audit: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/channels", () => ({
  CHANNEL_SESSION_REF_COLUMNS: "provider, waha_session_name",
  DEFAULT_CHANNEL_PROVIDER: "waha",
  resolveSessionRef: () => "test-session",
  getAdapter: () => ({
    isConfigured: () => true,
    resolveRecipient: () => "test-recipient@lid",
    send: mocks.send,
    codes: { sendFailed: "send_failed", notConfigured: "not_configured" },
  }),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";
const ctx: HandlerCtx = { organization_id: ORG, actor: { type: "user", id: USER }, requestId: "test" };
type Row = Record<string, unknown>;

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Deferred promises model remote IO; no clocks, live database or channel send. */
function fixture() {
  const gates = {
    receipt: deferred(), conversation: deferred(), contact: deferred(), audit: deferred(), event: deferred(),
  };
  const started = { conversation: false, contact: false, audit: false, event: false };
  const filters: Record<string, [string, unknown][]> = {};
  const state = { message: {} as Row, conversation: {} as Row, contact: {} as Row, audit: null as Row | null };
  mocks.audit.mockImplementation(async (entry: Row) => {
    started.audit = true;
    await gates.audit.promise;
    state.audit = entry;
  });
  mocks.send.mockResolvedValue({ externalId: "accepted-1" });

  function query(key: string, result: () => Promise<unknown>) {
    filters[key] = [];
    const chain = {
      select: () => chain,
      eq: (name: string, value: unknown) => { filters[key]!.push([name, value]); return chain; },
      in: () => chain,
      neq: () => chain,
      single: result,
      maybeSingle: result,
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => result().then(resolve, reject),
    };
    return chain;
  }

  const db = {
    from(table: string) {
      if (table === "conversations") return {
        select: () => query("conversation-read", async () => ({ data: {
          id: CONV, organization_id: ORG, contact_id: CONTACT, channel_session_id: "session-1",
          is_group: false, bot_silenced_until: null, last_inbound_at: "2026-09-25T12:00:00Z",
          contacts: { is_blocked: false },
          channel_sessions: { provider: "waha", waha_session_name: "test-session", status: "WORKING" },
        }, error: null })),
        update: (patch: Row) => query("conversation-write", async () => {
          started.conversation = true;
          await gates.conversation.promise;
          state.conversation = patch;
          return { error: null };
        }),
      };
      if (table === "messages") return {
        insert: (row: Row) => query("message-insert", async () => {
          state.message = { id: "message-1", ...row };
          return { data: state.message, error: null };
        }),
        delete: () => query("message-echo", async () => ({ error: null })),
        update: (patch: Row) => query("message-receipt", async () => {
          await gates.receipt.promise;
          state.message = { ...state.message, ...patch };
          return { data: state.message, error: null };
        }),
      };
      if (table === "contacts") return {
        update: (patch: Row) => query("contact-write", async () => {
          started.contact = true;
          await gates.contact.promise;
          state.contact = patch;
          return { error: null };
        }),
      };
      throw new Error(`unexpected table: ${table}`);
    },
    rpc: vi.fn(async (name: string, args: Row) => {
      expect(name).toBe("emit_event");
      expect(args.p_organization_id).toBe(ORG);
      started.event = true;
      // Consumer must only wake after all observable state and audit persisted.
      expect(state.conversation.last_outbound_at).toBeTruthy();
      expect(state.contact.last_activity_at).toBeTruthy();
      expect(state.audit?.resourceId).toBe("message-1");
      await gates.event.promise;
      return { error: null };
    }),
  };
  return { db: db as unknown as SupabaseClient, gates, started, filters, state };
}

beforeEach(() => vi.clearAllMocks());

describe("message receipt: independent persistence without premature response", () => {
  it("starts independent effects together only after the receipt and awaits them before the event", async () => {
    const f = fixture();
    let completed = false;
    const running = sendMessageHandler(f.db, ctx, { conversation_id: CONV, type: "text", body: "Test" })
      .then((message) => { completed = true; return message; });
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(f.started).toEqual({ conversation: false, contact: false, audit: false, event: false });

    f.gates.receipt.resolve();
    await vi.waitFor(() => expect(f.started).toEqual({ conversation: true, contact: true, audit: true, event: false }));
    expect(f.state.message).toMatchObject({ status: "sent", external_id: "accepted-1", organization_id: ORG });
    expect(f.filters["conversation-read"]).toContainEqual(["organization_id", ORG]);
    expect(f.filters["conversation-write"]).toContainEqual(["id", CONV]);
    expect(f.filters["contact-write"]).toEqual([["id", CONTACT], ["organization_id", ORG]]);

    f.gates.conversation.resolve();
    f.gates.contact.resolve();
    await vi.waitFor(() => expect(f.state.contact.last_activity_at).toBeTruthy());
    expect(completed).toBe(false);
    expect(f.started.event).toBe(false);
    f.gates.audit.resolve();
    await vi.waitFor(() => expect(f.started.event).toBe(true));
    expect(completed).toBe(false);
    f.gates.event.resolve();
    expect(await running).toMatchObject({ status: "sent", external_id: "accepted-1" });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it("waits remaining effects after a rejection and does not emit an event or send again", async () => {
    const f = fixture();
    f.gates.receipt.resolve();
    let completed = false;
    const running = sendMessageHandler(f.db, ctx, { conversation_id: CONV, type: "text", body: "Test" })
      .then(() => { completed = true; return null; }, (error: unknown) => { completed = true; return error; });
    await vi.waitFor(() => expect(f.started).toEqual({ conversation: true, contact: true, audit: true, event: false }));
    const error = new Error("conversation transport unavailable");
    f.gates.conversation.reject(error);
    f.gates.contact.resolve();
    await vi.waitFor(() => expect(f.state.contact.last_activity_at).toBeTruthy());
    expect(completed).toBe(false);
    expect(f.started.event).toBe(false);
    f.gates.audit.resolve();
    expect(await running).toBe(error);
    expect(f.started.event).toBe(false);
    expect(f.state.message).toMatchObject({ status: "sent", external_id: "accepted-1" });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
});
