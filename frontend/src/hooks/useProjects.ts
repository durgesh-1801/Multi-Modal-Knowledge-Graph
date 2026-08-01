/**
 * useProjects — CRUD hooks for /api/v1/projects
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';
import { Project } from '../types';

const PROJECTS_KEY = ['projects'] as const;

// ─── Fetch all projects ───────────────────────────────────────────────────────
export function useProjects() {
  const query = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async (): Promise<Project[]> => {
      try {
        const res = await apiClient.get<ApiResponse<Project[]>>('/projects');
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    retry: 2,
  });

  return {
    ...query,
    data: query.data ?? [],
  };
}

// ─── Create project ───────────────────────────────────────────────────────────
interface CreateProjectPayload {
  name: string;
  description: string;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProjectPayload): Promise<Project> => {
      const res = await apiClient.post<ApiResponse<Project>>('/projects', payload);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

// ─── Delete project ───────────────────────────────────────────────────────────
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiClient.delete<ApiResponse<{ project_id: string }>>(`/projects/${projectId}`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
