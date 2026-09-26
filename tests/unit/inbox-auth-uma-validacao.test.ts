import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAuthContext } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { GET as list } from "@/app/api/v1/conversations/route";
import { GET as detail } from "@/app/api/v1/conversations/[id]/route";
import { GET as messages } from "@/app/api/v1/conversations/[id]/messages/route";
import { GET as counts } from "@/app/api/v1/conversations/counts/route";
import { listConversationsHandler, getConversationHandler } from "@/app/api/v1/conversations/_handler";
import { listMessagesHandler } from "@/app/api/v1/messages/_handler";

const state = vi.hoisted(() => ({ cookieOrg: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => state.cookieOrg ? { value: state.cookieOrg } : undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/users/com-nome-do-atendente", () => ({ comNomeDoAtendente: async (rows: unknown[]) => rows }));
vi.mock("@/lib/ai/agents/org-tem-automatico", () => ({ orgTemAutomatico: vi.fn(async () => false) }));
vi.mock("@/app/api/v1/conversations/_handler", () => ({
  listConversationsHandler: vi.fn(async () => ({ conversations: [], cursor: null, has_more: false })),
  getConversationHandler: vi.fn(async () => ({ id: "33333333-3333-4333-8333-333333333333" })),
}));
vi.mock("@/app/api/v1/messages/_handler", () => ({
  listMessagesHandler: vi.fn(async () => ({ messages: [], cursor: null, has_more: false })),
}));

const USER = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const SUPPORT = {
  id: CONVERSATION, organization_id: OTHER, actor_user_id: USER,
  auth_session_id: CONVERSATION, previous_organization_id: ORG,
  expires_at: "2026-09-25T23:00:00Z", name: "Suporte", locale: "pt-BR",
  access_mode: "support_readonly", status: "active",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function database(options: {
  userId?: string;
  orgId?: string;
  noUser?: boolean;
  noMembership?: boolean;
  authError?: boolean;
  permissionError?: boolean;
  supportError?: boolean;
  support?: Record<string, unknown>;
  gate?: Promise<void>;
} = {}) {
  const starts: string[] = [];
  const filters: Array<[string, string, unknown]> = [];
  const userId = options.userId ?? USER;
  const orgId = options.orgId ?? ORG;
  const getUser = vi.fn(async () => ({
    data: { user: options.noUser ? null : { id: userId, email: "test@example.test", user_metadata: {} } },
    error: options.authError ? { name: "AuthApiError", message: "invalid token", status: 401 } : null,
  }));
  const rpc = vi.fn(async (name: string) => {
    expect(name).toBe("fn_support_context");
    starts.push("support");
    await options.gate;
    return { data: options.support ?? null, error: options.supportError ? { message: "unavailable" } : null };
  });
  const from = vi.fn((table: string) => {
    const read = async () => {
      starts.push(table);
      await options.gate;
      if (table === "platform_admins") return { data: null, error: null };
      if (table === "user_organizations") return {
        data: options.noMembership ? [] : [{ organization_id: orgId, role: "agent", organizations: { display_name: "Org", locale: "pt-BR" } }],
        error: options.permissionError ? { code: "PGRST002", message: "unavailable" } : null,
      };
      return { data: [], error: null, count: 0 };
    };
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => { filters.push([table, column, value]); return chain; },
      is: () => chain,
      order: () => chain,
      in: () => chain,
      not: () => chain,
      neq: () => chain,
      gt: () => chain,
      contains: () => chain,
      maybeSingle: read,
      then: (resolve: (result: Awaited<ReturnType<typeof read>>) => unknown, reject?: (error: unknown) => unknown) => read().then(resolve, reject),
    };
    return chain;
  });
  const client = { auth: { getUser }, from, rpc };
  return { client, getUser, from, rpc, starts, filters };
}

function useDatabase(db: ReturnType<typeof database>) {
  vi.mocked(createClient).mockResolvedValue(db.client as unknown as Awaited<ReturnType<typeof createClient>>);
}

const routes = [
  { name: "lista", run: () => list(new NextRequest(`http://localhost/api/v1/conversations?organization_id=${OTHER}`)), handler: listConversationsHandler },
  { name: "conversa", run: () => detail(new NextRequest(`http://localhost/api/v1/conversations/${CONVERSATION}?organization_id=${OTHER}`), { params: Promise.resolve({ id: CONVERSATION }) }), handler: getConversationHandler },
  { name: "mensagens", run: () => messages(new NextRequest(`http://localhost/api/v1/conversations/${CONVERSATION}/messages?organization_id=${OTHER}`), { params: Promise.resolve({ id: CONVERSATION }) }), handler: listMessagesHandler },
  { name: "contagens", run: () => counts(new NextRequest(`http://localhost/api/v1/conversations/counts?organization_id=${OTHER}`)), handler: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.cookieOrg = undefined;
});

describe("Inbox: uma validação por GET, no mesmo cliente sujeito a RLS", () => {
  it.each(routes)("$name valida uma vez e não aceita organização externa", async ({ run, handler }) => {
    const db = database();
    useDatabase(db);
    // Cookie de outra organização também precisa ser validado pelas memberships.
    state.cookieOrg = OTHER;
    expect((await run()).status).toBe(200);
    expect(db.getUser).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.filters).toContainEqual(["user_organizations", "user_id", USER]);
    if (handler) {
      expect(handler).toHaveBeenCalledWith(db.client, expect.objectContaining({ organization_id: ORG, actor: { type: "user", id: USER } }), expect.anything(), ...(handler === listMessagesHandler ? [expect.anything()] : []));
    } else {
      expect(db.filters.filter(([table, column]) => table === "conversations" && column === "organization_id")).toEqual(Array.from({ length: 7 }, () => ["conversations", "organization_id", ORG]));
    }
  });

  it.each(routes)("$name mantém 401 e não consulta permissões sem sessão", async ({ run, handler }) => {
    const db = database({ noUser: true });
    useDatabase(db);
    const response = await run();
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
    if (handler) expect(handler).not.toHaveBeenCalled();
  });

  it.each(routes)("$name mantém 403 quando não há organização autorizada", async ({ run, handler }) => {
    const db = database({ noMembership: true });
    useDatabase(db);
    const response = await run();
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("no_active_org");
    if (handler) expect(handler).not.toHaveBeenCalled();
  });
});

describe("contexto autenticado sem cache entre requisições", () => {
  it("as três leituras independentes começam antes de qualquer uma terminar", async () => {
    const gate = deferred<void>();
    const db = database({ gate: gate.promise });
    useDatabase(db);
    const pending = loadAuthContext();
    try {
      await vi.waitFor(() => expect(db.starts).toEqual(expect.arrayContaining(["platform_admins", "user_organizations", "support"])));
      expect(db.getUser).toHaveBeenCalledTimes(1);
    } finally {
      gate.resolve();
      await pending;
    }
  });

  it("duas requisições concorrentes mantêm identidades e clientes separados", async () => {
    const a = database();
    const b = database({ userId: OTHER, orgId: OTHER });
    vi.mocked(createClient)
      .mockResolvedValueOnce(a.client as unknown as Awaited<ReturnType<typeof createClient>>)
      .mockResolvedValueOnce(b.client as unknown as Awaited<ReturnType<typeof createClient>>);
    const [first, second] = await Promise.all([loadAuthContext(), loadAuthContext()]);
    expect(first.supabase).toBe(a.client);
    expect(second.supabase).toBe(b.client);
    expect(first.authUser?.id).toBe(USER);
    expect(second.authUser?.id).toBe(OTHER);
    expect(first.authUser?.organizations[0]?.organization_id).toBe(ORG);
    expect(second.authUser?.organizations[0]?.organization_id).toBe(OTHER);
  });

  it("erro de getUser fecha a sessão mesmo que o provedor devolva um usuário junto", async () => {
    const db = database({ authError: true });
    useDatabase(db);
    expect((await loadAuthContext()).authUser).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { label: "permissão", permissionError: true },
    { label: "suporte", supportError: true },
  ])("falha de $label continua recusando o contexto", async (options) => {
    useDatabase(database(options));
    await expect(loadAuthContext()).rejects.toThrow();
  });

  it("não serve a membership da requisição anterior depois de revogada", async () => {
    useDatabase(database());
    expect((await loadAuthContext()).authUser?.organizations).toHaveLength(1);
    useDatabase(database({ noMembership: true }));
    expect((await loadAuthContext()).authUser?.organizations).toEqual([]);
  });

  it("a organização de suporte vem da RPC, preservando o modo somente leitura", async () => {
    const db = database({ support: SUPPORT });
    useDatabase(db);
    state.cookieOrg = ORG;
    expect((await routes[0]!.run()).status).toBe(200);
    expect(listConversationsHandler).toHaveBeenCalledWith(db.client, expect.objectContaining({ organization_id: OTHER }), expect.anything());
    expect((await loadAuthContext()).authUser?.support?.access_mode).toBe("support_readonly");
  });

  it.each(["expired", "revoked"])("suporte %s continua bloqueado antes de ler conversas", async (status) => {
    useDatabase(database({ support: { ...SUPPORT, status } }));
    await expect(routes[0]!.run()).rejects.toThrow("redirect:/support-ended");
    expect(listConversationsHandler).not.toHaveBeenCalled();
  });
});
