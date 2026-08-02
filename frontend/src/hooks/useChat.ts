/**
 * useChat — hooks for /api/v1/chat
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';

// ─── Backend chat citation shape (matches backend ChatCitation schema) ─────────
export interface BackendChatCitation {
  document: string;
  page: number;
  snippet: string;
  relevance: number;
  chunk_id: string;
}

// ─── Backend chat response shape (matches backend ChatResponse schema) ──────────
export interface BackendChatResponse {
  success: boolean;
  answer: string;
  confidence: number;
  // citations are objects, NOT strings
  citations: BackendChatCitation[];
  // backend field is related_entities, not graph_nodes
  related_entities: string[];
  // backend field is processing_time (seconds), not processing_time_ms
  processing_time: number;
  query_type: string;
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
