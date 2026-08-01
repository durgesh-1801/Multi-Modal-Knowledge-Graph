import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, User } from '../types';

interface AuthContextType {
  user: User;
  activeRole: Role;
  token: string;
  switchRole: (role: Role) => void;
  hasPermission: (permission: string) => boolean;
  canAccessTab: (tab: string) => boolean;
}

const DEFAULT_USERS: Record<Role, User> = {
  ADMIN: {
    id: 'usr_admin_001',
    email: 'admin@enterprise.com',
    name: 'Sarah Jenkins',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  COMPLIANCE_OFFICER: {
    id: 'usr_officer_002',
    email: 'officer@enterprise.com',
    name: 'David Ross',
    role: 'COMPLIANCE_OFFICER',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  AUDITOR: {
    id: 'usr_auditor_003',
    email: 'auditor@enterprise.com',
    name: 'Elena Rostova',
    role: 'AUDITOR',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<Role>('ADMIN');
  const [user, setUser] = useState<User>(DEFAULT_USERS.ADMIN);
  const [token, setToken] = useState<string>('mock_admin_token');

  const switchRole = (newRole: Role) => {
    setActiveRole(newRole);
    setUser(DEFAULT_USERS[newRole]);
    setToken(`mock_${newRole.toLowerCase()}_token`);
  };

  const canAccessTab = (tab: string): boolean => {
    const allowedRoles = TAB_PERMISSIONS[tab];
    if (!allowedRoles) return true;
    return allowedRoles.includes(activeRole);
  };

  const hasPermission = (permission: string): boolean => {
    if (activeRole === 'ADMIN') return true;
    if (activeRole === 'COMPLIANCE_OFFICER') {
      const allowed = [
        'UPLOAD_DOCUMENT', 'UPLOAD_AUDIO', 'ASK_AI', 'VIEW_GRAPH',
        'SEARCH_GRAPH', 'VIEW_ANALYTICS', 'VIEW_CITATIONS', 'VIEW_REPORTS', 'DOWNLOAD_REPORTS'
      ];
      return allowed.includes(permission);
    }
    if (activeRole === 'AUDITOR') {
      const allowed = [
        'ASK_AI', 'VIEW_GRAPH', 'SEARCH_GRAPH', 'VIEW_CITATIONS',
        'VIEW_ANALYTICS', 'VIEW_REPORTS', 'DOWNLOAD_REPORTS'
      ];
      return allowed.includes(permission);
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        token,
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
