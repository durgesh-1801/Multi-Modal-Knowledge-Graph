import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects';
import { Toast, useToast } from './Toast';
import { getErrorMessage } from '../lib/api';

export const ProjectsView: React.FC = () => {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'ADMIN';
  const { toast, showToast, dismissToast } = useToast();

  // ── Real API data ─────────────────────────────────────────────────────────
  const { data: projects = [], isLoading, error, refetch } = useProjects();
  const { mutateAsync: createProject, isPending: isCreating } = useCreateProject();
  const { mutateAsync: deleteProject } = useDeleteProject();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await createProject({ name, description });
      showToast(`Project "${name}" created successfully.`, 'success');
      setName('');
      setDescription('');
      setShowCreateModal(false);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleDeleteProject = async (projId: string, projName: string) => {
    if (!confirm(`Delete project "${projName}"?`)) return;
    try {
      await deleteProject(projId);
      showToast(`Project deleted.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Enterprise Compliance Projects</h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize documents, knowledge graph subgraphs, and team member role assignments by compliance scope.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 cursor-pointer" title="Refresh">
            <span className="material-symbols-outlined text-base text-slate-600">refresh</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">create_new_folder</span>
              Create New Project
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <span className="material-symbols-outlined text-3xl text-red-400 mb-2 block">error_outline</span>
          <p className="text-sm font-semibold text-slate-700 mb-4">Failed to load projects</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer">Retry</button>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-2 p-10 text-center bg-white rounded-2xl border border-slate-200">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">folder_open</span>
              <p className="text-sm font-semibold text-slate-600 mb-1">No Projects Yet</p>
              <p className="text-xs text-slate-400">{isAdmin ? 'Create your first compliance project above.' : 'No projects have been created yet.'}</p>
            </div>
          ) : (
            (projects || []).map((proj) => (
              <div key={proj.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Project #{proj.id ? proj.id.substring(Math.max(0, proj.id.length - 8)) : '00000000'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1.5">{proj.name}</h3>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteProject(proj.id, proj.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">{proj.description}</p>

                  {/* Members List */}
                  <div className="mb-4">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Assigned Team Members ({(proj.members || []).length})
                    </p>
                    <div className="space-y-1.5">
                      {(proj.members || []).map((m) => (
                        <div key={m.user_id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                              {(m.user_name || m.user_email || 'U')[0]}
                            </div>
                            <span className="font-semibold text-slate-800">{m.user_name || m.user_email}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400 font-mono">
                  <span>Created: {proj.created_at ? new Date(proj.created_at).toLocaleDateString() : '—'}</span>
                  <span>Updated: {proj.updated_at ? new Date(proj.updated_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Create Enterprise Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ISO 27001 Security Standard Audit"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Scope</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe compliance parameters and knowledge graph domain focus..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isCreating ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
