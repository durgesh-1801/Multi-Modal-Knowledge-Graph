import React, { useState } from 'react';
import { NavigationTab } from '../types';

interface HeaderProps {
  activeTab: NavigationTab;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'explorer':
        return 'GraphAI Compliance';
      case 'chat':
        return 'GraphAI Compliance';
      default:
        return null;
    }
  };

  const headerTitle = getHeaderTitle();

  return (
    <header className="fixed top-0 right-0 left-60 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs flex justify-between items-center px-6 z-40">
      <div className="flex items-center gap-4 flex-1">
        {headerTitle && (
          <div className="flex items-center gap-3">
            <span className="font-headline-md text-headline-md font-extrabold text-blue-600">
              {headerTitle}
            </span>
            {activeTab === 'chat' && (
              <>
                <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
                <span className="font-label-md text-slate-500 text-xs hidden md:inline-block font-medium">
                  Session: HIPAA-Q3-Review
                </span>
              </>
            )}
          </div>
        )}

        <div className={`relative w-full max-w-md ${headerTitle ? 'ml-6' : ''}`}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={
              activeTab === 'explorer'
                ? 'Search entities...'
                : activeTab === 'chat'
                ? 'Search conversation context...'
                : 'Search knowledge graph...'
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-1.5 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 transition-all shadow-2xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
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
                <div className="p-2.5 bg-emerald-50/70 border-l-3 border-emerald-600 rounded-r-xl">
                  <p className="text-xs text-emerald-700 font-bold mb-0.5">HIPAA Audit Passed</p>
                  <p className="text-[11px] text-slate-600">Section 164.308 compliance score upgraded to A+.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all duration-200 cursor-pointer"
          title="Light Mode Active"
        >
          <span className="material-symbols-outlined text-xl">light_mode</span>
        </button>

        <div className="h-6 w-[1px] bg-slate-200"></div>

        <div className="flex items-center gap-3 cursor-pointer p-1 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="text-right hidden lg:block">
            <p className="font-label-md text-xs font-bold text-slate-900">Compliance Officer</p>
            <p className="text-[10px] text-slate-500 font-medium">Admin Access</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
            <span className="material-symbols-outlined text-lg">account_circle</span>
          </div>
        </div>
      </div>
    </header>
  );
};
