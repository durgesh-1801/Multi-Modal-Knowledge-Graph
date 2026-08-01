import React from 'react';
import { useAuth } from '../context/AuthContext';

interface AccessDeniedViewProps {
  attemptedTab?: string;
  onReturnDashboard: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  attemptedTab = 'restricted area',
  onReturnDashboard,
}) => {
  const { activeRole, user } = useAuth();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
      <div className="w-20 h-20 rounded-3xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-sm mb-6">
        <span className="material-symbols-outlined text-4xl">gpp_bad</span>
      </div>

      <div className="max-w-md">
        <span className="inline-block px-3 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-full border border-red-200 uppercase tracking-widest mb-3">
          HTTP 403 Forbidden
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Your current account role <strong className="text-slate-900">"{activeRole.replace('_', ' ')}"</strong> ({user.email}) lacks required permissions to access <span className="font-semibold text-slate-900">"{attemptedTab}"</span>.
        </p>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">User Context:</span>
            <span className="font-bold text-slate-800">{user.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Active Role:</span>
            <span className="font-bold text-red-600">{activeRole}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Enforcement Mode:</span>
            <span className="font-bold text-emerald-600">Enterprise RBAC Strict</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onReturnDashboard}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            Return to Allowed Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
