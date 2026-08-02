import React, { useRef, useState, useEffect } from 'react';
import { NavigationTab, Role, User } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { user, activeRole, canAccessTab, logout } = useAuth();

  // Role-tailored navigation items matrix
  const getNavItems = () => {
    switch (activeRole) {
      case 'ADMIN':
        return [
          { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: 'dashboard' },
          { id: 'projects' as NavigationTab, label: 'Projects', icon: 'folder_open' },
          { id: 'users' as NavigationTab, label: 'User Management', icon: 'manage_accounts' },
          { id: 'upload' as NavigationTab, label: 'Upload Center', icon: 'cloud_upload' },
          { id: 'documents' as NavigationTab, label: 'Documents', icon: 'description' },
          { id: 'knowledge-graph' as NavigationTab, label: 'Knowledge Graph', icon: 'hub' },
          { id: 'chat' as NavigationTab, label: 'AI Chat', icon: 'forum' },
          { id: 'analytics' as NavigationTab, label: 'Analytics', icon: 'insights' },
          { id: 'reports' as NavigationTab, label: 'Compliance Reports', icon: 'assessment' },
          { id: 'logs' as NavigationTab, label: 'Audit Logs', icon: 'receipt_long' },
        ];
      case 'COMPLIANCE_OFFICER':
        return [
          { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: 'dashboard' },
          { id: 'projects' as NavigationTab, label: 'Projects', icon: 'folder_open' },
          { id: 'upload' as NavigationTab, label: 'Upload Center', icon: 'cloud_upload' },
          { id: 'documents' as NavigationTab, label: 'Documents', icon: 'description' },
          { id: 'knowledge-graph' as NavigationTab, label: 'Knowledge Graph', icon: 'hub' },
          { id: 'chat' as NavigationTab, label: 'AI Chat', icon: 'forum' },
          { id: 'analytics' as NavigationTab, label: 'Analytics', icon: 'insights' },
          { id: 'reports' as NavigationTab, label: 'Compliance Reports', icon: 'assessment' },
        ];
      case 'AUDITOR':
        return [
          { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: 'dashboard' },
          { id: 'projects' as NavigationTab, label: 'Projects', icon: 'folder_open' },
          { id: 'knowledge-graph' as NavigationTab, label: 'Knowledge Graph', icon: 'hub' },
          { id: 'chat' as NavigationTab, label: 'AI Chat', icon: 'forum' },
          { id: 'analytics' as NavigationTab, label: 'Analytics', icon: 'insights' },
          { id: 'reports' as NavigationTab, label: 'Compliance Reports', icon: 'assessment' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 bg-white border-r border-slate-200 shadow-sm flex flex-col p-4 z-50">
      {/* Brand Header */}
      <div className="mb-6 flex items-center gap-3 px-2 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-white text-xl">hub</span>
        </div>
        <div>
          <h1 className="font-headline-md text-[18px] font-bold text-slate-900 leading-none">Enterprise AI</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-0.5">
            RBAC Compliance
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id || (item.id === 'knowledge-graph' && activeTab === 'explorer');
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'fill text-blue-600' : 'text-slate-500'}`}>
                {item.icon}
              </span>
              <span className="font-label-md text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings Footer (Admin Only) & User Profile */}
      <div className="mt-auto pt-3 border-t border-slate-200 space-y-2">
        {activeRole === 'ADMIN' && (
          <button
            onClick={() => onSelectTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
            }`}
          >
            <span className="material-symbols-outlined text-slate-500">settings</span>
            <span className="font-label-md text-sm">System Settings</span>
          </button>
        )}

        <UserProfileCard user={user} activeRole={activeRole} />
      </div>
    </aside>
  );
};

// ─── Role styling maps ─────────────────────────────────────────────────────────
const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLIANCE_OFFICER: 'bg-purple-50 text-purple-700 border-purple-200',
  AUDITOR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const AVATAR_BG: Record<Role, string> = {
  ADMIN: 'bg-blue-600',
  COMPLIANCE_OFFICER: 'bg-purple-600',
  AUDITOR: 'bg-emerald-600',
};

// ─── User Profile Card with Sign-Out Dropdown ──────────────────────────────────
interface UserProfileCardProps {
  user: User | null;
  activeRole: Role;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, activeRole }) => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = (activeRole || 'ADMIN').replace('_', ' ');
  const avatarBg = AVATAR_BG[activeRole] ?? 'bg-blue-600';
  const badgeCls = ROLE_BADGE[activeRole] ?? ROLE_BADGE['ADMIN'];

  return (
    <div ref={wrapperRef} className="relative">

      {/* ── Dropdown Panel (opens above the card) ───────────────────────────── */}
      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-[60]"
          style={{ animation: 'fadeSlideUp 0.15s ease-out' }}
        >
          {/* User info header */}
          <div className="px-4 py-3.5 bg-gradient-to-br from-slate-50 to-blue-50/40 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate leading-tight">{user?.name ?? 'User'}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email ?? ''}</p>
                <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mt-1.5 ${badgeCls}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out button */}
          <button
            id="sidebar-signout-btn"
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer group"
          >
            <span className="material-symbols-outlined text-lg text-red-500 group-hover:scale-110 transition-transform">
              logout
            </span>
            Sign out
            <span className="ml-auto text-[10px] text-slate-400 font-normal">Change profile</span>
          </button>
        </div>
      )}

      {/* ── Profile Card Trigger ─────────────────────────────────────────────── */}
      <button
        id="sidebar-profile-btn"
        onClick={() => setOpen((v) => !v)}
        title="Account options"
        className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer text-left ${
          open
            ? 'bg-blue-50 border-blue-200 shadow-sm'
            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
        }`}
      >
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-xs shadow-xs flex-shrink-0`}>
          {initials}
        </div>

        {/* Name + role */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-label-md text-xs font-bold text-slate-900 truncate leading-tight">
            {user?.name ?? 'User'}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded w-fit border mt-0.5 ${badgeCls}`}>
            {roleLabel}
          </span>
        </div>

        {/* Chevron */}
        <span
          className={`material-symbols-outlined text-base text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          expand_less
        </span>
      </button>

      {/* Inline keyframe for the dropdown */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
