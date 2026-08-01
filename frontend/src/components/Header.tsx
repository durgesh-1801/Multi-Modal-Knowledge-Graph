import React, { useState } from 'react';
import { NavigationTab, Role } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  activeTab: NavigationTab;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const { user, activeRole, switchRole } = useAuth();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const getRoleBadgeStyle = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'COMPLIANCE_OFFICER':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'AUDITOR':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    }
  };

  return (
    <header className="fixed top-0 right-0 left-60 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs flex justify-between items-center px-6 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-3">
          <span className="font-headline-md text-headline-md font-extrabold text-blue-600">
            GraphAI Compliance
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(activeRole || 'ADMIN')} uppercase tracking-wider`}>
            {(activeRole || 'ADMIN').replace('_', ' ')}
          </span>
        </div>

        <div className="relative w-full max-w-md ml-4">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search enterprise knowledge graph & documents..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-1.5 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 transition-all shadow-2xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Role Switcher Dropdown for Testing & Evaluation */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all text-xs font-semibold text-slate-800 cursor-pointer"
            title="Switch User Role for Testing"
          >
            <span className="material-symbols-outlined text-sm text-blue-600">published_with_changes</span>
            <span>Switch Role: <strong>{activeRole || 'ADMIN'}</strong></span>
            <span className="material-symbols-outlined text-sm">arrow_drop_down</span>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Select Active Role
              </div>
              <button
                onClick={() => { switchRole('ADMIN'); setShowRoleMenu(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-purple-50 cursor-pointer ${activeRole === 'ADMIN' ? 'font-bold text-purple-700 bg-purple-50/50' : 'text-slate-700'}`}
              >
                <span>Admin</span>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">Full Access</span>
              </button>
              <button
                onClick={() => { switchRole('COMPLIANCE_OFFICER'); setShowRoleMenu(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-blue-50 cursor-pointer ${activeRole === 'COMPLIANCE_OFFICER' ? 'font-bold text-blue-700 bg-blue-50/50' : 'text-slate-700'}`}
              >
                <span>Compliance Officer</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Ingest & RAG</span>
              </button>
              <button
                onClick={() => { switchRole('AUDITOR'); setShowRoleMenu(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 cursor-pointer ${activeRole === 'AUDITOR' ? 'font-bold text-emerald-700 bg-emerald-50/50' : 'text-slate-700'}`}
              >
                <span>Auditor</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Read-Only</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all duration-200 relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl p-4 shadow-xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <span className="font-label-md text-xs font-bold text-slate-900">System Alerts</span>
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">3 New</span>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                <div className="p-2.5 bg-red-50/70 border-l-3 border-red-500 rounded-r-xl">
                  <p className="text-xs text-red-700 font-bold mb-0.5">GDPR Breach Alert</p>
                  <p className="text-[11px] text-slate-600">14 unmasked PII instances in Shared_Drive_A.</p>
                </div>
                <div className="p-2.5 bg-blue-50/70 border-l-3 border-blue-600 rounded-r-xl">
                  <p className="text-xs text-blue-700 font-bold mb-0.5">Batch Completed</p>
                  <p className="text-[11px] text-slate-600">Legal_Corp_2024.zip batch relationship extraction done.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-[1px] bg-slate-200"></div>

        <div className="flex items-center gap-3 p-1">
          <div className="text-right hidden lg:block">
            <p className="font-label-md text-xs font-bold text-slate-900">{user?.name ?? 'User'}</p>
            <p className="text-[10px] text-slate-500 font-medium">{user?.email ?? '—'}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
            <span className="material-symbols-outlined text-lg">account_circle</span>
          </div>
        </div>
      </div>
    </header>
  );
};
