import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery, type InfiniteData } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClaimConversation } from "@/hooks/inbox/useClaimConversation";
import { useArchiveConversation, useCloseConversation, useReopenConversation } from "@/hooks/inbox/useCloseConversation";
import { applyConfirmedConversation } from "@/lib/inbox/confirmed-conversation-cache";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import type { Conversation } from "@/lib/types/messaging";

const { post, patch, showApiError } = vi.hoisted(() => ({
  post: vi.fn(), patch: vi.fn(), showApiError: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ apiClient: { post, patch } }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError }));

const listKey = ["conversations", {}] as const;
const detailKey = ["conversation", "conversation-1"] as const;
const countKey = ["conversation-counts", "org-1", "unread=true"] as const;
type Pages = InfiniteData<{ data: ConversationWithContact[]; meta?: { cursor: string } }>;
const row = {
  id: "conversation-1", organization_id: "org-1", contact_id: "contact-1",
  channel_session_id: "channel-1", channel: "whatsapp", status: "open",
  status_changed_at: "2026-09-25T10:00:00Z", service_revision: 1,
  assigned_to_user_id: null, assigned_to_user_name: null, assignee_kind: null, assigned_at: null,
  last_inbound_at: null, last_outbound_at: null, last_message_at: null,
  last_message_preview: "Mensagem anterior", unread_count_for_assignee: 2,
  is_group: false, group_chat_id: null, tags: [], metadata: {}, snooze_until: null,
  bot_silenced_until: null, last_handoff_at: null,
  created_at: "2026-09-25T10:00:00Z", updated_at: "2026-09-25T10:00:00Z",
  comando_da_conversa: "automatico",
  contacts: { id: "contact-1", display_name: "Cliente", name: null, phone_number: null, tags: [], is_blocked: false, is_anonymized: false },
  channel_sessions: { phone_number: null, display_name: "Vendas", provider: null },
} satisfies ConversationWithContact;

function response(status: string, overrides: Partial<Conversation> = {}): Conversation {
  const { contacts: _contacts, channel_sessions: _channel, comando_da_conversa: _command, ...base } = row;
  return { ...base, status, service_revision: 2, updated_at: "2026-09-25T10:01:00Z", ...overrides };
}

function seed(qc: QueryClient) {
  qc.setQueryData<Pages>(listKey, { pages: [{ data: [row], meta: { cursor: "keep" } }], pageParams: [undefined] });
  qc.setQueryData(detailKey, row);
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  seed(qc);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("ações do inbox mostram o que o servidor confirmou sem esperar outra leitura", () => {
  it.each([
    ["assumir", useClaimConversation, "claimed", "post"],
    ["fechar", useCloseConversation, "closed", "post"],
    ["arquivar", useArchiveConversation, "archived", "patch"],
    ["reabrir", useReopenConversation, "open", "patch"],
  ] as const)("%s atualiza lista/detalhe e reconcilia contagens com o GET ainda pendente", async (_name, useAction, status, method) => {
    const { qc, wrapper } = setup();
    const confirmed = response(status, { assigned_to_user_id: "attendant-1", assigned_to_user_name: "Atendente" });
    (method === "post" ? post : patch).mockResolvedValueOnce({ data: confirmed });
    const readList = vi.fn(() => new Promise<Pages>(() => {}));
    const readCount = vi.fn(async () => ({ mine: 1 }));
    const { result } = renderHook(() => ({
      action: useAction(),
      list: useQuery({ queryKey: listKey, queryFn: readList }),
      counts: useQuery({ queryKey: countKey, queryFn: readCount }),
    }), { wrapper });
    await waitFor(() => expect(readCount).toHaveBeenCalledTimes(1));

    await act(async () => { await result.current.action.mutateAsync({ conversation_id: row.id }); });

    // React Query publica a mudança do observer na próxima tarefa. O GET fica
    // pendente para provar que essa publicação não depende da resposta dele.
    await waitFor(() => {
      expect(result.current.action.isSuccess).toBe(true);
      expect(result.current.list.isFetching).toBe(true);
    });
    expect(readList).toHaveBeenCalledTimes(1);
    expect(result.current.list.data?.pages[0]?.data[0]).toMatchObject({
      status, assigned_to_user_id: "attendant-1", contacts: row.contacts, channel_sessions: row.channel_sessions,
    });
    expect(qc.getQueryData(detailKey)).toMatchObject({ status, service_revision: 2, contacts: row.contacts });
    expect(qc.getQueryData<Pages>(listKey)?.pages[0]?.meta).toEqual({ cursor: "keep" });
    await waitFor(() => expect(readCount).toHaveBeenCalledTimes(2));
    qc.clear();
  });

  it("não inventa sucesso quando a escrita falha", async () => {
    const { qc, wrapper } = setup();
    const error = new Error("conflito");
    post.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useClaimConversation(), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ conversation_id: row.id })).rejects.toThrow("conflito"); });
    expect(qc.getQueryData(detailKey)).toEqual(row);
    expect(qc.getQueryData<Pages>(listKey)?.pages[0]?.data[0]).toEqual(row);
    expect(showApiError).toHaveBeenCalledWith(error);
    qc.clear();
  });

  it("uma resposta atrasada não desfaz uma revisão ou atividade mais nova", async () => {
    const { qc } = setup();
    await applyConfirmedConversation(qc, response("closed", { service_revision: 3, updated_at: "2026-09-25T10:03:00Z" }));
    await applyConfirmedConversation(qc, response("open"));
    expect(qc.getQueryData<Conversation>(detailKey)?.status).toBe("closed");
    await applyConfirmedConversation(qc, response("claimed", { service_revision: 3, updated_at: "2026-09-25T10:02:00Z" }));
    expect(qc.getQueryData<Conversation>(detailKey)?.status).toBe("closed");
    qc.clear();
  });

  it("cancela a leitura anterior à escrita sem permitir que sua resposta desfaça o sucesso", async () => {
    const { qc } = setup();
    let finishRead!: (value: ConversationWithContact) => void;
    const pendingRead = qc.fetchQuery({ queryKey: detailKey, staleTime: 0, queryFn: () => new Promise<ConversationWithContact>((resolve) => { finishRead = resolve; }) });
    const settled = pendingRead.catch(() => undefined);
    await applyConfirmedConversation(qc, response("closed"));
    finishRead(row);
    await settled;
    expect(qc.getQueryData<Conversation>(detailKey)?.status).toBe("closed");
    qc.clear();
  });

  it("preserva outras conversas e não cria presença em uma lista filtrada", async () => {
    const { qc } = setup();
    const another = { ...row, id: "conversation-2" };
    const filteredKey = ["conversations", { status: "archived" }];
    const filtered = { pages: [{ data: [another] }], pageParams: [undefined] };
    qc.setQueryData(filteredKey, filtered);
    qc.removeQueries({ queryKey: detailKey });
    await applyConfirmedConversation(qc, response("closed"));
    expect(qc.getQueryData(filteredKey)).toEqual(filtered);
    // A lista já autorizada fornece os joins ao detalhe, mesmo depois de a
    // reconciliação retirar a conversa da aba em que o operador estava.
    expect(qc.getQueryData(detailKey)).toMatchObject({ status: "closed", contacts: row.contacts });
    qc.clear();
  });

  it("não reaproveita um cache de outra organização nem cria detalhe sem joins conhecidos", async () => {
    const { qc } = setup();
    await applyConfirmedConversation(qc, response("closed", { organization_id: "org-2" }));
    expect(qc.getQueryData(detailKey)).toEqual(row);
    await applyConfirmedConversation(qc, response("closed", { id: "unseen" }));
    expect(qc.getQueryData(["conversation", "unseen"])).toBeUndefined();
    qc.clear();
  });
});
