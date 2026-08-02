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
  frameworks?: string[];
  owner?: string;
  members: ProjectMember[];
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

// ─── Sub-member mutations ────────────────────────────────────────────────────
export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, member }: { projectId: string; member: { name: string; email: string; role: string } }): Promise<Project> => {
      const res = await apiClient.post<ApiResponse<Project>>(`/projects/${projectId}/members`, member);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, memberId }: { projectId: string; memberId: string }): Promise<Project> => {
      const res = await apiClient.delete<ApiResponse<Project>>(`/projects/${projectId}/members/${memberId}`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProjectMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, memberId, role }: { projectId: string; memberId: string; role: string }): Promise<Project> => {
      const res = await apiClient.patch<ApiResponse<Project>>(`/projects/${projectId}/members/${memberId}`, { role });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
