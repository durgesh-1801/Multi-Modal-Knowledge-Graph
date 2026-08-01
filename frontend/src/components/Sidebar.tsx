import React from 'react';
import { NavigationTab } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: 'dashboard' },
    { id: 'upload' as NavigationTab, label: 'Upload Center', icon: 'cloud_upload' },
    { id: 'documents' as NavigationTab, label: 'Documents', icon: 'description' },
    { id: 'knowledge-graph' as NavigationTab, label: 'Knowledge Graph', icon: 'hub' },
    { id: 'chat' as NavigationTab, label: 'AI Chat', icon: 'forum' },
    { id: 'analytics' as NavigationTab, label: 'Analytics', icon: 'insights' },
    { id: 'explorer' as NavigationTab, label: 'Graph Explorer', icon: 'account_tree' },
  ];

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 bg-white border-r border-slate-200 shadow-sm flex flex-col p-4 z-50">
      {/* Brand Logo */}
      <div className="mb-8 flex items-center gap-3 px-2 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-white text-xl">hub</span>
        </div>
        <div>
          <h1 className="font-headline-md text-[20px] font-bold text-slate-900 leading-none">Enterprise AI</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-0.5">Compliance Engine</p>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id || (item.id === 'knowledge-graph' && activeTab === 'explorer');
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'fill text-blue-600' : 'text-slate-500'}`}>{item.icon}</span>
              <span className="font-label-md text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings & User Profile Footer */}
      <div className="mt-auto pt-4 border-t border-slate-200 space-y-3">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
          }`}
        >
          <span className="material-symbols-outlined text-slate-500">settings</span>
          <span className="font-label-md text-sm">Settings</span>
        </button>

        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            JD
          </div>
          <div className="flex flex-col">
            <span className="font-label-md text-xs font-bold text-slate-900">John Doe</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Compliance Lead</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
