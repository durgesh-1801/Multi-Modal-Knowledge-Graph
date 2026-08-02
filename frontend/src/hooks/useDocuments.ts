/**
 * useDocuments — React Query hook for /api/v1/documents
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';

export interface DocumentItem {
  id: string;
  name: string;
  uuid: string;
  type: 'pdf' | 'audio' | 'doc' | 'image';
  size: string;
  size_bytes?: number;
  updated: string;
  status: 'Compliant' | 'Risk Flagged' | 'Processing';
  confidence: number;
  framework: string;
  entities: string[];
  node_count?: number;
  riskScore?: string;
}

export function useDocuments() {
  const query = useQuery({
    queryKey: ['documents'],
    queryFn: async (): Promise<DocumentItem[]> => {
      try {
        const res = await apiClient.get<ApiResponse<DocumentItem[]>>('/documents');
        if (Array.isArray(res.data?.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
    staleTime: 5_000,
    retry: 1,
  });

  return {
    ...query,
    documents: query.data ?? [],
  };
}

export function useDeleteDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await apiClient.delete<ApiResponse<unknown>>(`/documents/${encodeURIComponent(documentId)}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['graph'] });
      qc.invalidateQueries({ queryKey: ['statistics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useBulkDeleteDocuments() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (documentIds: string[]) => {
      const res = await apiClient.delete<ApiResponse<unknown>>('/documents/bulk', {
        data: { document_ids: documentIds },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['graph'] });
      qc.invalidateQueries({ queryKey: ['statistics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useClearAllDocuments() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<unknown>>('/documents/all');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['graph'] });
      qc.invalidateQueries({ queryKey: ['statistics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
