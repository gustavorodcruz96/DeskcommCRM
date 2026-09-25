import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import type { Conversation } from "@/lib/types/messaging";

interface ConversationPage {
  data: ConversationWithContact[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

/** Uma resposta atrasada nunca desfaz uma revisão ou atividade já observada. */
function mergeConfirmed(
  current: ConversationWithContact,
  confirmed: Conversation,
): ConversationWithContact {
  if (current.id !== confirmed.id || current.organization_id !== confirmed.organization_id) return current;
  if ((current.service_revision ?? 0) > (confirmed.service_revision ?? 0)) return current;
  if (Date.parse(current.updated_at) > Date.parse(confirmed.updated_at)) return current;
  // A mutação devolve a linha, sem os joins de contato/canal usados pelo Inbox.
  // O comando calculado da consulta antiga deixa de valer após assumir/fechar.
  const { comando_da_conversa: _comando, ...previous } = current;
  return { ...previous, ...confirmed };
}

/**
 * Mostra a resposta CONFIRMADA de assumir/fechar/arquivar/reabrir sem outra ida
 * à API. Só toca linhas já autorizadas e presentes no cache; nunca acrescenta
 * conversas a listas filtradas. Pertencimento, ordem e contagens continuam
 * sendo reconciliados pelo servidor, sem duplicar filtros/RBAC no navegador.
 */
export async function applyConfirmedConversation(qc: QueryClient, confirmed: Conversation): Promise<void> {
  if (!confirmed?.id || !confirmed.organization_id) return;

  // Uma leitura iniciada antes da escrita não pode voltar depois e desfazê-la.
  // Sem revert: cancelar não restaura um snapshot anterior a outra mutação.
  await Promise.all([
    qc.cancelQueries({ queryKey: ["conversations"] }, { revert: false }),
    qc.cancelQueries({ queryKey: ["conversation", confirmed.id] }, { revert: false }),
  ]);

  let fromList: ConversationWithContact | undefined;
  qc.setQueriesData<InfiniteData<ConversationPage>>({ queryKey: ["conversations"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: page.data.map((row) => {
          if (row.id !== confirmed.id || row.organization_id !== confirmed.organization_id) return row;
          const merged = mergeConfirmed(row, confirmed);
          if (!fromList || Date.parse(merged.updated_at) > Date.parse(fromList.updated_at)) fromList = merged;
          return merged;
        }),
      })),
    };
  });
  qc.setQueryData<ConversationWithContact>(["conversation", confirmed.id], (old) =>
    old ? mergeConfirmed(old, confirmed) : fromList,
  );
}
