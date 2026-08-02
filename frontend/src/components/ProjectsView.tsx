import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from '../hooks/useProjects';
import { Toast, useToast } from './Toast';
import { getErrorMessage } from '../lib/api';
import { ProjectMember } from '../types';

const AVAILABLE_ROLES = [
  'Admin',
  'Compliance Officer',
  'Auditor',
  'Security Analyst',
  'Risk Manager',
  'Legal Officer',
  'Project Manager',
  'Viewer',
] as const;

const STANDARD_FRAMEWORKS = [
  'ISO 27001',
  'GDPR',
  'HIPAA',
  'SOC 2',
  'PCI DSS',
  'NIST CSF',
  'NIST SP 800-53',
  'RBI',
  'Custom',
] as const;

export const ProjectsView: React.FC = () => {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'ADMIN';
  const { toast, showToast, dismissToast } = useToast();

  const { data: projects = [], isLoading, error, refetch } = useProjects();
  const { mutateAsync: createProject, isPending: isCreating } = useCreateProject();
  const { mutateAsync: deleteProject } = useDeleteProject();
  const { mutateAsync: addMember } = useAddProjectMember();
  const { mutateAsync: removeMember } = useRemoveProjectMember();
  const { mutateAsync: updateMemberRole } = useUpdateProjectMemberRole();

  // Create Project Modal Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['ISO 27001', 'GDPR']);
  const [customFramework, setCustomFramework] = useState('');
  const [members, setMembers] = useState<ProjectMember[]>([
    {
      name: user?.name || 'Sarah Jenkins',
      email: user?.email || 'admin@enterprise.com',
      role: 'Admin',
    },
  ]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Inline Add Member Modal State for Existing Projects
  const [addMemberModalProjId, setAddMemberModalProjId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<string>('Compliance Officer');

  const toggleFramework = (fw: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    );
  };

  const handleAddMemberRow = () => {
    setMembers((prev) => [
      ...prev,
      { name: '', email: '', role: 'Compliance Officer' },
    ]);
  };

  const handleRemoveMemberRow = (index: number) => {
    if (members.length <= 1) {
      showToast('A project must contain at least one team member.', 'error');
      return;
    }
    setMembers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMemberChange = (index: number, field: keyof ProjectMember, value: string) => {
    setMembers((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, [field]: value } : m))
    );
  };

  const validateForm = (): boolean => {
    setValidationError(null);
    if (!name.trim()) {
      setValidationError('Project Name is required.');
      return false;
    }
    if (members.length === 0) {
      setValidationError('At least one team member is required.');
      return false;
    }
    for (const m of members) {
      if (!m.name.trim() || !m.email.trim()) {
        setValidationError('All team member rows must have a valid Full Name and Email.');
        return false;
      }
    }
    const emails = members.map((m) => m.email.trim().lowerCase?.() || m.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      setValidationError('Duplicate team member emails are not allowed within a project.');
      return false;
    }
    const hasAdmin = members.some((m) => m.role === 'Admin');
    if (!hasAdmin) {
      setValidationError('Project Owner / Team must contain at least one member with the Admin role.');
      return false;
    }
    return true;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Assemble final frameworks array
    const finalFrameworks = selectedFrameworks.filter((f) => f !== 'Custom');
    if (selectedFrameworks.includes('Custom') && customFramework.trim()) {
      finalFrameworks.push(`Custom: ${customFramework.trim()}`);
    }

    try {
      await createProject({
        name: name.trim(),
        description: description.trim(),
        frameworks: finalFrameworks,
        members: members.map((m) => ({ ...m, name: m.name.trim(), email: m.email.trim() })),
      });
      showToast(`Project "${name}" created successfully.`, 'success');
      setName('');
      setDescription('');
      setSelectedFrameworks(['ISO 27001', 'GDPR']);
      setCustomFramework('');
      setMembers([
        {
          name: user?.name || 'Sarah Jenkins',
          email: user?.email || 'admin@enterprise.com',
          role: 'Admin',
        },
      ]);
      setShowCreateModal(false);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleDeleteProject = async (projId: string, projName: string) => {
    if (!confirm(`Delete project "${projName}"?`)) return;
    try {
      await deleteProject(projId);
      showToast('Project deleted successfully.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleAddMemberToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberModalProjId || !newMemberName.trim() || !newMemberEmail.trim()) return;

    try {
      await addMember({
        projectId: addMemberModalProjId,
        member: {
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
        },
      });
      showToast(`Member "${newMemberName}" assigned to project.`, 'success');
      setAddMemberModalProjId(null);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberRole('Compliance Officer');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleRemoveMemberFromProject = async (projId: string, memberId: string, memberName: string) => {
    if (!confirm(`Remove member "${memberName}" from project?`)) return;
    try {
      await removeMember({ projectId: projId, memberId });
      showToast(`Member removed from project.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleRoleChange = async (projId: string, memberId: string, role: string) => {
    try {
      await updateMemberRole({ projectId: projId, memberId, role });
      showToast(`Member role updated to ${role}.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Compliance Officer':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Auditor':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Security Analyst':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'Risk Manager':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Legal Officer':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Project Manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">corporate_fare</span>
            Enterprise Compliance Projects
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Governance workspace for organizing multi-modal documents, compliance frameworks, and assigned team member roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 cursor-pointer transition-colors"
            title="Refresh Projects"
          >
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <span className="material-symbols-outlined text-3xl text-red-400 mb-2 block">error_outline</span>
          <p className="text-sm font-semibold text-slate-700 mb-4">Failed to load projects</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-2 p-12 text-center bg-white rounded-2xl border border-slate-200">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">folder_open</span>
              <p className="text-sm font-semibold text-slate-600 mb-1">No Compliance Projects</p>
              <p className="text-xs text-slate-400 mb-4">
                {isAdmin ? 'Create your first compliance project to assign team members and scope frameworks.' : 'No active projects available.'}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Create Project
                </button>
              )}
            </div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {proj.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Owner: {proj.owner || 'Admin'}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{proj.name}</h3>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteProject(proj.id, proj.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Project"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">{proj.description}</p>

                  {/* Compliance Framework Badges */}
                  {proj.frameworks && proj.frameworks.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Governed Frameworks
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {proj.frameworks.map((fw, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[12px] text-blue-600">verified</span>
                            {fw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Team Members */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Assigned Team Members ({(proj.members || []).length})
                      </p>
                      {isAdmin && (
                        <button
                          onClick={() => setAddMemberModalProjId(proj.id)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">person_add</span>
                          Add Member
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {(proj.members || []).map((m, idx) => {
                        const memberKey = m.id || m.email || `mem-${idx}`;
                        return (
                          <div
                            key={memberKey}
                            className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {(m.name || m.email || 'U')[0].toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="font-semibold text-slate-800 truncate">{m.name || 'Team Member'}</div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">{m.email}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isAdmin ? (
                                <select
                                  value={m.role}
                                  onChange={(e) => handleRoleChange(proj.id, m.id || m.email, e.target.value)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer ${getRoleBadgeStyle(
                                    m.role
                                  )}`}
                                >
                                  {AVAILABLE_ROLES.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getRoleBadgeStyle(
                                    m.role
                                  )}`}
                                >
                                  {m.role}
                                </span>
                              )}

                              {isAdmin && (proj.members || []).length > 1 && (
                                <button
                                  onClick={() => handleRemoveMemberFromProject(proj.id, m.id || m.email, m.name)}
                                  className="text-slate-300 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                                  title="Remove Member"
                                >
                                  <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>Created: {proj.created_at ? new Date(proj.created_at).toLocaleDateString() : '—'}</span>
                  <span>Updated: {proj.updated_at ? new Date(proj.updated_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Enterprise Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 animate-in zoom-in-95 my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">folder_managed</span>
                <h3 className="text-base font-bold text-slate-900">Create Enterprise Compliance Project</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-6 overflow-y-auto pr-1 py-4 flex-1">
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error_outline</span>
                  {validationError}
                </div>
              )}

              {/* Basic Metadata */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. HIPAA & GDPR Data Protection Audit 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description / Scope</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe compliance parameters, target data repositories, and risk assessment scope..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Compliance Frameworks Checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Compliance Frameworks & Standards
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  {STANDARD_FRAMEWORKS.map((fw) => {
                    const isChecked = selectedFrameworks.includes(fw);
                    return (
                      <label
                        key={fw}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFramework(fw)}
                          className="accent-blue-600 w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <span>{fw}</span>
                      </label>
                    );
                  })}
                </div>

                {selectedFrameworks.includes('Custom') && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={customFramework}
                      onChange={(e) => setCustomFramework(e.target.value)}
                      placeholder="Enter custom framework name (e.g. NIST SP 800-171, Internal Security Policy)..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Project Team Members */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Project Team Members <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddMemberRow}
                    className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-blue-200"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    Add Member
                  </button>
                </div>

                <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
                  {members.map((m, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          required
                          value={m.name}
                          onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                          placeholder="Full Name (e.g. Sarah Jenkins)"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div className="flex-1 w-full">
                        <input
                          type="email"
                          required
                          value={m.email}
                          onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                          placeholder="Email (e.g. sarah@enterprise.com)"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div className="w-full sm:w-44">
                        <select
                          value={m.role}
                          onChange={(e) => handleMemberChange(idx, 'role', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                          {AVAILABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>

                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberRow(idx)}
                          className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Member Row"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Summary Preview Panel */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-2 text-xs">
                <div className="font-bold text-blue-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">summarize</span>
                  Project Summary Preview
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-500 block text-[10px]">PROJECT NAME</span>
                    <span className="font-bold text-slate-900">{name || '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block text-[10px]">OWNER</span>
                    <span className="font-bold text-slate-900">
                      {members.find((m) => m.role === 'Admin')?.name || members[0]?.name || 'Admin'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block text-[10px]">SELECTED FRAMEWORKS</span>
                    <span className="font-bold text-slate-900">{selectedFrameworks.join(', ') || 'None'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block text-[10px]">MEMBER COUNT</span>
                    <span className="font-bold text-slate-900">{members.length} Assigned</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 shrink-0">
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isCreating ? 'Creating Project…' : 'Create Enterprise Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal for Existing Project */}
      {addMemberModalProjId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Assign Member to Project</h3>
              <button
                onClick={() => setAddMemberModalProjId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMemberToProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="e.g. elena@enterprise.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Assignment</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  {AVAILABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddMemberModalProjId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Assign Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
