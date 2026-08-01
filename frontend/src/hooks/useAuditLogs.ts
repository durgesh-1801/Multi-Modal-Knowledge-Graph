/**
 * useAuditLogs — hook for GET /api/v1/logs
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';
import { AuditLog } from '../types';

export function useAuditLogs(limit = 100) {
  const query = useQuery({
    queryKey: ['logs', limit],
    queryFn: async (): Promise<AuditLog[]> => {
      try {
        const res = await apiClient.get<ApiResponse<AuditLog[]>>('/logs', {
          params: { limit },
        });
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    retry: 1,
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}
