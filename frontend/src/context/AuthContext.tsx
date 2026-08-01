/**
 * AuthContext — Real JWT Authentication.
 *
 * - login()  → POST /api/v1/auth/login  → stores JWT + user in localStorage
 * - logout() → clears localStorage, resets state
 * - On mount  → reads localStorage token, calls GET /api/v1/auth/me to restore session
 * - switchRole() kept for demo convenience (switches the UI role without a new login)
 * - canAccessTab / hasPermission use backend-issued permissions
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiClient, getErrorMessage } from '../lib/api';
import { LoginRequest, Role, TokenResponse, User, UserProfileResponse } from '../types';

// ─── Permission map (mirrors backend ROLE_PERMISSIONS) ───────────────────────
const TAB_PERMISSIONS: Record<string, Role[]> = {
  dashboard: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  projects: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  users: ['ADMIN'],
  upload: ['ADMIN', 'COMPLIANCE_OFFICER'],
  documents: ['ADMIN', 'COMPLIANCE_OFFICER'],
  'knowledge-graph': ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  explorer: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  chat: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  analytics: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  reports: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  settings: ['ADMIN'],
  logs: ['ADMIN'],
};

// ─── Context Shape ────────────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null;
  activeRole: Role;
  token: string | null;
  permissions: string[];
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => void;
  hasPermission: (permission: string) => boolean;
  canAccessTab: (tab: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Fallback users (for demo role switcher only when already authenticated) ──
const ROLE_DEMO_EMAILS: Record<Role, string> = {
  ADMIN: 'admin@enterprise.com',
  COMPLIANCE_OFFICER: 'officer@enterprise.com',
  AUDITOR: 'auditor@enterprise.com',
};
const ROLE_DEMO_PASSWORDS: Record<Role, string> = {
  ADMIN: 'admin123',
  COMPLIANCE_OFFICER: 'officer123',
  AUDITOR: 'auditor123',
};

// ─── Provider ────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<Role>('ADMIN');
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const logoutHandled = useRef(false);

  // ── Persist helpers ──────────────────────────────────────────────────────
  const persistSession = useCallback((tok: string, usr: User) => {
    localStorage.setItem('access_token', tok);
    localStorage.setItem('current_user', JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
    setActiveRole(usr.role as Role);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    setToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  // ── Fetch /auth/me permissions after token is set ────────────────────────
  const fetchPermissions = useCallback(async (tok: string) => {
    try {
      const res = await apiClient.get<{ success: boolean; data: UserProfileResponse }>('/auth/me', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.data?.data?.permissions) {
        setPermissions(res.data.data.permissions);
      }
    } catch {
      // non-fatal — continue with empty permissions
    }
  }, []);

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('current_user');

    if (savedToken && savedUser) {
      try {
        const parsedUser: User = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        setActiveRole(parsedUser.role as Role);
        fetchPermissions(savedToken).finally(() => setIsAuthLoading(false));
      } catch {
        clearSession();
        setIsAuthLoading(false);
      }
    } else {
      setIsAuthLoading(false);
    }
  }, [clearSession, fetchPermissions]);

  // ── Listen for 401 events from axios interceptor ─────────────────────────
  useEffect(() => {
    const handleAuthLogout = () => {
      if (!logoutHandled.current) {
        logoutHandled.current = true;
        clearSession();
        setTimeout(() => { logoutHandled.current = false; }, 1000);
      }
    };
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [clearSession]);

  // ── login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const req: LoginRequest = { email, password };
    const res = await apiClient.post<{ success: boolean; data: TokenResponse }>('/auth/login', req);
    const { access_token, user: loggedUser } = res.data.data;
    persistSession(access_token, loggedUser);
    await fetchPermissions(access_token);
  }, [persistSession, fetchPermissions]);

  // ── logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // ── switchRole (demo mode — re-logins with seeded credentials) ───────────
  const switchRole = useCallback(async (newRole: Role) => {
    try {
      const email = ROLE_DEMO_EMAILS[newRole];
      const password = ROLE_DEMO_PASSWORDS[newRole];
      const res = await apiClient.post<{ success: boolean; data: TokenResponse }>('/auth/login', {
        email,
        password,
      });
      const { access_token, user: newUser } = res.data.data;
      persistSession(access_token, newUser);
      await fetchPermissions(access_token);
    } catch {
      // Fallback: just switch UI role without new token
      setActiveRole(newRole);
    }
  }, [persistSession, fetchPermissions]);

  // ── canAccessTab ─────────────────────────────────────────────────────────
  const canAccessTab = useCallback((tab: string): boolean => {
    if (!user) return false;
    const allowed = TAB_PERMISSIONS[tab];
    if (!allowed) return true;
    return allowed.includes(activeRole);
  }, [user, activeRole]);

  // ── hasPermission ────────────────────────────────────────────────────────
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (activeRole === 'ADMIN') return true;
    return permissions.includes(permission);
  }, [user, activeRole, permissions]);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        token,
        permissions,
        isAuthLoading,
        login,
        logout,
        switchRole,
        hasPermission,
        canAccessTab,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
