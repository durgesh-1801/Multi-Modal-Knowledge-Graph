/**
 * useSettings — hooks for /api/v1/settings
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';
import { SystemSettingsData } from '../types';

const SETTINGS_KEY = ['settings'] as const;

export const DEFAULT_SETTINGS: SystemSettingsData = {
  llm_provider: 'Groq Llama-3.3 70B Versatile',
  neo4j_uri: 'bolt://localhost:7687',
  qdrant_url: 'http://localhost:6333',
  embedding_model: 'all-MiniLM-L6-v2',
  api_key_status: 'Configured',
  theme: 'light',
  security_audit_mode: true,
};

export function useSettings() {
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<SystemSettingsData> => {
      try {
        const res = await apiClient.get<ApiResponse<SystemSettingsData>>('/settings');
        return res.data?.data || DEFAULT_SETTINGS;
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    retry: 1,
    staleTime: 60_000,
  });

  return {
    ...query,
    data: query.data ?? DEFAULT_SETTINGS,
  };
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SystemSettingsData>): Promise<SystemSettingsData> => {
      const res = await apiClient.post<ApiResponse<SystemSettingsData>>('/settings', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEY, data);
    },
  });
}
