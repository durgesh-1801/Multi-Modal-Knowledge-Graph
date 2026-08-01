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
    <header className="fixed top-0 right-0 left-60 h-16 bg-surface/70 backdrop-blur-xl border-b border-outline-variant/20 shadow-md flex justify-between items-center px-6 z-40">
      <div className="flex items-center gap-4 flex-1">
        {headerTitle && (
          <div className="flex items-center gap-3">
            <span className="font-headline-md text-headline-md font-extrabold text-primary">
              {headerTitle}
            </span>
            {activeTab === 'chat' && (
              <>
                <div className="h-6 w-px bg-outline-variant/30 hidden md:block"></div>
                <span className="font-label-md text-on-surface-variant text-xs hidden md:inline-block">
                  Session: HIPAA-Q3-Review
                </span>
              </>
            )}
          </div>
        )}

        <div className={`relative w-full max-w-md ${headerTitle ? 'ml-6' : ''}`}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
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
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-full py-1.5 pl-10 pr-4 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-on-surface-variant hover:text-primary transition-all duration-200 relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 glass-panel rounded-2xl p-4 shadow-2xl border border-outline-variant/30 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-outline-variant/20">
                <span className="font-label-md text-xs font-bold text-on-surface">System Alerts</span>
                <span className="text-[10px] text-tertiary font-bold uppercase tracking-wider">3 New</span>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                <div className="p-2 bg-error-container/10 border-l-2 border-error rounded-r-lg">
                  <p className="text-xs text-error font-bold mb-0.5">GDPR Breach Alert</p>
                  <p className="text-[11px] text-on-surface-variant">14 unmasked PII instances in Shared_Drive_A.</p>
                </div>
                <div className="p-2 bg-primary-container/10 border-l-2 border-primary rounded-r-lg">
                  <p className="text-xs text-primary font-bold mb-0.5">Batch Completed</p>
                  <p className="text-[11px] text-on-surface-variant">Legal_Corp_2024.zip batch relationship extraction done.</p>
                </div>
                <div className="p-2 bg-tertiary-container/10 border-l-2 border-tertiary rounded-r-lg">
                  <p className="text-xs text-tertiary font-bold mb-0.5">HIPAA Audit Passed</p>
                  <p className="text-[11px] text-on-surface-variant">Section 164.308 compliance score upgraded to A+.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className="p-2 text-on-surface-variant hover:text-primary transition-all duration-200 cursor-pointer"
          title="Toggle Dark Mode"
        >
          <span className="material-symbols-outlined">dark_mode</span>
        </button>

        <div className="h-6 w-[1px] bg-outline-variant/30"></div>

        <div className="flex items-center gap-3 cursor-pointer">
          <div className="text-right hidden lg:block">
            <p className="font-label-md text-xs font-medium text-on-surface">Compliance Officer</p>
            <p className="text-[10px] text-on-surface-variant">Admin Access</p>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
            <span className="material-symbols-outlined text-base">account_circle</span>
          </div>
        </div>
      </div>
    </header>
  );
};
