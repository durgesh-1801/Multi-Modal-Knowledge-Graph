/**
 * useChat — hooks for /api/v1/chat
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';

// ─── Backend chat response shape ──────────────────────────────────────────────
export interface BackendChatResponse {
  answer: string;
  confidence: number;
  citations: string[];
  source_chunks: Array<{ source: string; content: string; score: number }>;
  graph_nodes: string[];
  processing_time_ms?: number;
  conversation_id: string;
}

// ─── Send chat message ────────────────────────────────────────────────────────
interface SendMessagePayload {
  query: string;
  conversation_id?: string;
  session_id?: string;
  top_k?: number;
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (payload: SendMessagePayload): Promise<BackendChatResponse> => {
      const res = await apiClient.post<ApiResponse<BackendChatResponse>>('/chat', payload);
      return res.data.data;
    },
  });
}

// ─── Fetch chat history ───────────────────────────────────────────────────────
export function useChatHistory(conversationId: string | null) {
  const query = useQuery({
    queryKey: ['chat', 'history', conversationId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<unknown[]>>(`/chat/history/${conversationId}`);
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    enabled: !!conversationId,
    retry: 1,
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}

// ─── Clear chat history ───────────────────────────────────────────────────────
export function useClearChatHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiClient.delete<ApiResponse<{ conversation_id: string; cleared: boolean }>>(
        `/chat/history/${conversationId}`,
      );
      return res.data.data;
    },
    onSuccess: (_, conversationId) => {
      qc.invalidateQueries({ queryKey: ['chat', 'history', conversationId] });
    },
  });
}
