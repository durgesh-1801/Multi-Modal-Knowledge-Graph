/**
 * useUsers — CRUD hooks for /api/v1/users
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse, getErrorMessage } from '../lib/api';
import { Role, User, UserStatus } from '../types';

const USERS_KEY = ['users'] as const;

// ─── Fetch all users ──────────────────────────────────────────────────────────
export function useUsers() {
  const query = useQuery({
    queryKey: USERS_KEY,
    queryFn: async (): Promise<User[]> => {
      try {
        const res = await apiClient.get<ApiResponse<User[]>>('/users');
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

// ─── Create user ──────────────────────────────────────────────────────────────
interface CreateUserPayload {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload): Promise<User> => {
      const res = await apiClient.post<ApiResponse<User>>('/users', payload);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
    onError: (err) => console.error('Create user error:', getErrorMessage(err)),
  });
}

// ─── Update user role ─────────────────────────────────────────────────────────
interface UpdateRolePayload { userId: string; role: Role }

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: UpdateRolePayload): Promise<User> => {
      const res = await apiClient.patch<ApiResponse<User>>(`/users/${userId}/role`, { role });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

// ─── Update user status ───────────────────────────────────────────────────────
interface UpdateStatusPayload { userId: string; status: UserStatus }

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: UpdateStatusPayload): Promise<User> => {
      const res = await apiClient.patch<ApiResponse<User>>(`/users/${userId}/status`, { status });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

// ─── Delete user ──────────────────────────────────────────────────────────────
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.delete<ApiResponse<{ user_id: string }>>(`/users/${userId}`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
