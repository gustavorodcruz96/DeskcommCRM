import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import type { HandlerCtx } from "@/lib/api/handlers/types";

const mocks = vi.hoisted(() => ({ audit: vi.fn(), send: vi.fn(), warn: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn } }));
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
function fixture(onCompleted: (operation: string) => void = () => {}) {
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
    onCompleted("audit");
  });
  mocks.send.mockResolvedValue({ externalId: "accepted-1" });

  function query(key: string, result: () => Promise<unknown>) {
    filters[key] = [];
    const complete = async () => {
      const value = await result();
      onCompleted(key);
      return value;
    };
    const chain = {
      select: () => chain,
      eq: (name: string, value: unknown) => { filters[key]!.push([name, value]); return chain; },
      in: () => chain,
      neq: () => chain,
      single: complete,
      maybeSingle: complete,
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => complete().then(resolve, reject),
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
      onCompleted("event");
      return { error: null };
    }),
  };
  return { db: db as unknown as SupabaseClient, gates, started, filters, state };
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

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

describe("slow successful sends: timing without message data", () => {
  function timedFixture(costs: Record<string, number>) {
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const f = fixture((operation) => { clock += costs[operation] ?? 0; });
    mocks.send.mockImplementation(async () => {
      clock += costs.send ?? 0;
      return { externalId: "private-provider-id" };
    });
    for (const gate of Object.values(f.gates)) gate.resolve();
    return f;
  }

  it("attributes elapsed time to awaited phases and logs only the allowed fields", async () => {
    const f = timedFixture({
      "conversation-read": 125, "message-insert": 375, send: 250,
      "message-echo": 300, "message-receipt": 1_000, audit: 1_000, event: 75,
    });
    const message = await sendMessageHandler(f.db, ctx, {
      conversation_id: CONV, type: "text", body: "private body +5511999999999",
      media_url: "https://private.invalid/media?credential=secret",
      metadata: { credential: "private token", contact_name: "Private Person" },
    });
    expect(message.status).toBe("sent");
    expect(mocks.warn).toHaveBeenCalledExactlyOnceWith("messages.send.slow", {
      requestId: "test", type: "text", status: "sent", total_ms: 3_125,
      durations_ms: {
        initial_reads: 125, insert_queued: 375, preparation: 0, recipient_and_send: 250,
        persist_receipt: 1_300, post_effects: 1_000, event: 75,
      },
    });
    const logged = JSON.stringify(mocks.warn.mock.calls);
    for (const privateValue of [ORG, CONV, CONTACT, USER, "private", "Private", "+5511999999999"]) {
      expect(logged).not.toContain(privateValue);
    }
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it.each([2_999, 3_000, 3_001])("logs only when elapsed time exceeds 3 seconds (%i ms)", async (elapsed) => {
    const f = timedFixture({ "conversation-read": elapsed });
    await sendMessageHandler(f.db, ctx, { conversation_id: CONV, type: "text", body: "Test" });
    expect(mocks.warn).toHaveBeenCalledTimes(elapsed > 3_000 ? 1 : 0);
  });

  it("preserves accepted status if the logger itself fails", async () => {
    const f = timedFixture({ send: 3_001 });
    mocks.warn.mockImplementation(() => { throw new Error("log output unavailable"); });
    await expect(sendMessageHandler(f.db, ctx, { conversation_id: CONV, type: "text", body: "Test" }))
      .resolves.toMatchObject({ status: "sent", external_id: "private-provider-id" });
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("does not label a slow failed send as a successful send", async () => {
    const f = timedFixture({ "conversation-read": 3_001 });
    mocks.send.mockRejectedValue(new Error("private provider failure"));
    await expect(sendMessageHandler(f.db, ctx, { conversation_id: CONV, type: "text", body: "Test" }))
      .resolves.toMatchObject({ status: "failed", error_message: "private provider failure" });
    expect(mocks.warn).not.toHaveBeenCalled();
  });
});
