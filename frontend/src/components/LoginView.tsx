/**
 * LoginView — minimal login gate matching the existing enterprise UI style.
 * Does NOT redesign anything — uses the same color palette and patterns as the rest of the app.
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@enterprise.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (role: 'admin' | 'officer' | 'auditor') => {
    const creds = {
      admin: { email: 'admin@enterprise.com', password: 'admin123' },
      officer: { email: 'officer@enterprise.com', password: 'officer123' },
      auditor: { email: 'auditor@enterprise.com', password: 'auditor123' },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="material-symbols-outlined text-white text-2xl fill">hub</span>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Enterprise AI</p>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Compliance Engine</h1>
            </div>
          </div>
          <p className="text-sm text-slate-500">Sign in to access the Knowledge Graph Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@enterprise.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                  Authenticating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">lock_open</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Quick access shortcuts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { role: 'admin' as const, label: 'Admin', icon: 'admin_panel_settings', color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
                { role: 'officer' as const, label: 'Officer', icon: 'verified_user', color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
                { role: 'auditor' as const, label: 'Auditor', icon: 'fact_check', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
              ].map((btn) => (
                <button
                  key={btn.role}
                  type="button"
                  onClick={() => quickLogin(btn.role)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${btn.color}`}
                >
                  <span className="material-symbols-outlined text-lg">{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Multi-Modal Knowledge Graph Platform • Enterprise Compliance Edition
        </p>
      </div>
    </div>
  );
};
