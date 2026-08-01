import React, { useState } from 'react';
import { AuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { useAuditLogs } from '../hooks/useAuditLogs';

export const AuditLogsView: React.FC = () => {
  const { user } = useAuth();
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const { data: logs = [], isLoading, error, refetch } = useAuditLogs(200);

  const filteredLogs = (logs || []).filter((log) => {
    if (filterAction === 'ALL') return true;
    return log?.action ? log.action.includes(filterAction) : false;
  });

  const getActionBadgeStyle = (action?: string) => {
    if (!action) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (action.includes('LOGIN') || action.includes('USER')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (action.includes('UPLOAD') || action.includes('DOCUMENT')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (action.includes('MERGE') || action.includes('GRAPH')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (action.includes('SETTINGS')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-md border border-red-200 w-fit mb-2">
            <span className="material-symbols-outlined text-sm">security</span>
            Enterprise Security Audit Stream
          </div>
          <h2 className="text-xl font-bold text-slate-900">System Audit Logs</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time immutable audit tracking for logins, document uploads, graph edits, user management, and settings changes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 pl-1">Filter Action:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All System Actions</option>
              <option value="USER">User Changes</option>
              <option value="UPLOAD">Uploads</option>
              <option value="GRAPH">Graph Changes</option>
              <option value="SETTINGS">Settings Changes</option>
              <option value="LOGIN">Login Events</option>
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 cursor-pointer transition-colors"
            title="Refresh logs"
          >
            <span className="material-symbols-outlined text-base text-slate-600">refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Audit Event Stream ({filteredLogs.length} Entries)
          </span>
          <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Immutable Audit Storage
          </span>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-red-400 mb-2 block">error_outline</span>
            <p className="text-sm font-semibold text-slate-700 mb-1">Failed to load audit logs</p>
            <p className="text-xs text-slate-500 mb-4">The backend may not be running or the token may have expired.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredLogs.length === 0 && (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">manage_search</span>
            <p className="text-sm text-slate-500">No audit log entries found{filterAction !== 'ALL' ? ` for filter "${filterAction}"` : ''}.</p>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Timestamp (UTC)</th>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">IP Address</th>
                  <th className="px-6 py-3.5">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                      {log?.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{log?.user_email ?? '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase border border-slate-200">
                        {log?.role ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider ${getActionBadgeStyle(log?.action)}`}>
                        {log?.action ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{log?.ip_address ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-700 max-w-xs truncate" title={log?.details ?? ''}>{log?.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
