"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { Conversation } from "@/lib/types/messaging";
import { applyConfirmedConversation } from "@/lib/inbox/confirmed-conversation-cache";

interface ClaimArgs {
  conversation_id: string;
  expected_assignee?: string | null;
}

export function useClaimConversation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: ClaimArgs) =>
      apiClient.post<{ data: Conversation }>(
        `/api/v1/conversations/${args.conversation_id}/claim`,
        { expected_assignee: args.expected_assignee ?? null },
      ),
    onError: (err, args) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", args.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversation-counts"] });
      showApiError(err);
    },
    onSuccess: async (data, args) => {
      await applyConfirmedConversation(qc, data.data);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", args.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversation-counts"] });
    },
  });
}
