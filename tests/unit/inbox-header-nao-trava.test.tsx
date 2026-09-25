import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConversationHeader } from "@/components/inbox/ConversationHeader";

// O layout compacto aprovado agrupa ações secundárias sem remover operações.
// Dimensões reais são medidas em Chromium, não pelo layout inexistente do jsdom.

vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useCloseConversation", () => ({
  useCloseConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenConversation: () => ({ mutate: vi.fn(), isPending: false }),
  // O header passou a importar `useArchiveConversation` do MESMO módulo (issue
  // #923). Um dublê fechado que não acompanha a nova exportação não falha com
  // "faltou mock": falha com "useArchiveConversation is not a function", que
  // não fala nada do que este arquivo vigia.
  useArchiveConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useReleaseConversation", () => ({
  useReleaseConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O nome do módulo importa: a primeira versão deste arquivo mockava
// "useResumeAi", que NÃO EXISTE — o real é `useResumeAiAttendance`. O teste
// passou assim mesmo (o hook verdadeiro rodou sob o provider), ou seja, o mock
// não mockava nada e ninguém era avisado. Mock de caminho inexistente é ruído
// que parece cobertura.
vi.mock("@/hooks/inbox/useResumeAiAttendance", () => ({
  useResumeAiAttendance: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O header monta o discador (`DialButton`), que exige o `VoiceCallProvider` do
// shell autenticado. Aqui só a largura importa: o discador fica fora da conta.
vi.mock("@/components/voice/DialButton", () => ({ DialButton: () => null }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useAuth: () => ({ user: { id: "u-1" }, activeOrg: { orgId: "org-1", role: "manager" } }),
}));

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: "ct-1",
  status: "open",
  assigned_to_user_id: null,
  assignee_kind: "ai",
  snooze_until: null,
  tags: [],
  contacts: { id: "ct-1", display_name: "Fulana", name: null, phone_number: "5511999" },
} as unknown as React.ComponentProps<typeof ConversationHeader>["conversation"];

function renderHeader(conv = conversation) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConversationHeader conversation={conv} />
    </QueryClientProvider>,
  );
}

describe("header compacto do inbox", () => {
  it("oferece assumir e abre ações secundárias sem executar uma mutação", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: "Assumir" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Transferir" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mais ações da conversa" }));
    for (const name of ["Transferir", "Fechar", "Arquivar", "Lembrar"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "Ver contato" })).toHaveAttribute(
      "href",
      "/app/contacts/ct-1",
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Transferir" })).toBeNull();
  });

  it("mantém o aviso do automático visível e as operações humanas acessíveis", () => {
    renderHeader({
      ...conversation,
      status: "assigned",
      assigned_to_user_id: "u-1",
      assigned_to_user_name: "Eu",
      assignee_kind: "user",
      bot_silenced_until: new Date(Date.now() + 10 * 60_000).toISOString(),
    } as typeof conversation);
    expect(screen.getByTestId("badge-atendimento-humano").textContent).toBe(
      "Automático volta em instantes",
    );
    expect(screen.getByRole("button", { name: "Concluir atendimento" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mais ações da conversa" }));
    for (const name of ["Liberar", "Devolver ao automático", "Transferir", "Lembrar", "Arquivar"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });
});
