import React, { useState } from 'react';
import { Project, Role } from '../types';
import { useAuth } from '../context/AuthContext';

export const ProjectsView: React.FC = () => {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'ADMIN';

  const [projects, setProjects] = useState<Project[]>([
    {
      id: 'proj_compliance_2026',
      name: 'HIPAA & GDPR Compliance Automation',
      description: 'Multi-modal Knowledge Graph automated auditing & compliance engine.',
      owner_id: 'usr_admin_001',
      members: [
        { user_id: 'usr_admin_001', user_name: 'Sarah Jenkins', user_email: 'admin@enterprise.com', role: 'ADMIN' },
        { user_id: 'usr_officer_002', user_name: 'David Ross', user_email: 'officer@enterprise.com', role: 'COMPLIANCE_OFFICER' },
        { user_id: 'usr_auditor_003', user_name: 'Elena Rostova', user_email: 'auditor@enterprise.com', role: 'AUDITOR' },
      ],
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-07-25T16:20:00Z',
    },
    {
      id: 'proj_financial_audit',
      name: 'SOC2 Type II Security Review',
      description: 'Automated policy ingestion, vector chunking, and graph vulnerability evaluation.',
      owner_id: 'usr_admin_001',
      members: [
        { user_id: 'usr_admin_001', user_name: 'Sarah Jenkins', user_email: 'admin@enterprise.com', role: 'ADMIN' },
        { user_id: 'usr_officer_002', user_name: 'David Ross', user_email: 'officer@enterprise.com', role: 'COMPLIANCE_OFFICER' },
      ],
      created_at: '2026-04-05T09:30:00Z',
      updated_at: '2026-07-18T11:45:00Z',
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newProj: Project = {
      id: `proj_${Math.random().toString(36).substring(2, 9)}`,
      name,
      description,
      owner_id: user.id,
      members: [
        { user_id: user.id, user_name: user.name, user_email: user.email, role: user.role }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setProjects([newProj, ...projects]);
    setName('');
    setDescription('');
    setShowCreateModal(false);
  };

  const handleDeleteProject = (projId: string) => {
    if (confirm('Delete this project?')) {
      setProjects(projects.filter((p) => p.id !== projId));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Enterprise Compliance Projects</h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize documents, knowledge graph subgraphs, and team member role assignments by compliance scope.
          </p>
        </div>

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

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((proj) => (
          <div key={proj.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex justify-between items-start gap-3 mb-3">
                <div>
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Project #{proj.id.substring(5, 12)}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1.5">{proj.name}</h3>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteProject(proj.id)}
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
                  Assigned Team Members ({proj.members.length})
                </p>
                <div className="space-y-1.5">
                  {proj.members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                          {(m.user_name || 'U')[0]}
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
              <span>Created: {new Date(proj.created_at).toLocaleDateString()}</span>
              <span>Updated: {new Date(proj.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
