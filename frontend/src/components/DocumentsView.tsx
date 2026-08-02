import React, { useState } from 'react';
import { NavigationTab } from '../types';
import { useDocuments, useDeleteDocument, useBulkDeleteDocuments, useClearAllDocuments } from '../hooks/useDocuments';

interface DocumentsViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ onNavigate }) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'single' | 'bulk' | 'clear_all';
    docId?: string;
    docName?: string;
  } | null>(null);

  const { documents } = useDocuments();
  const { mutateAsync: deleteDocument, isPending: isDeletingSingle } = useDeleteDocument();
  const { mutateAsync: bulkDelete, isPending: isDeletingBulk } = useBulkDeleteDocuments();
  const { mutateAsync: clearAll, isPending: isClearingAll } = useClearAllDocuments();

  const isProcessing = isDeletingSingle || isDeletingBulk || isClearingAll;

  const filteredDocs = (documents || []).filter((doc) => {
    const matchesFilter = filterStatus === 'All' || doc.status === filterStatus;
    const matchesSearch =
      (doc.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.framework || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.entities || []).some((e) => (e || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDocIds(filteredDocs.map((d) => d.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleSelectOne = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const executeConfirmAction = async () => {
    if (!confirmModal) return;
    try {
      if (confirmModal.type === 'single' && confirmModal.docId) {
        await deleteDocument(confirmModal.docId);
        setSelectedDocIds((prev) => prev.filter((id) => id !== confirmModal.docId));
      } else if (confirmModal.type === 'bulk' && selectedDocIds.length > 0) {
        await bulkDelete(selectedDocIds);
        setSelectedDocIds([]);
      } else if (confirmModal.type === 'clear_all') {
        await clearAll();
        setSelectedDocIds([]);
      }
    } catch (err) {
      console.error('Document lifecycle operation failed:', err);
    } finally {
      setConfirmModal(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">Compliance Documents</h2>
          <p className="text-body-md text-xs text-on-surface-variant mt-1">
            Library of parsed documents, compliance scores, and extracted relationship entities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {selectedDocIds.length > 0 && (
            <button
              disabled={isProcessing}
              onClick={() => setConfirmModal({ type: 'bulk' })}
              className="px-4 py-2 bg-error text-on-error rounded-xl font-label-md text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-error/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Delete Selected ({selectedDocIds.length})
            </button>
          )}

          {documents.length > 0 && (
            <button
              disabled={isProcessing}
              onClick={() => setConfirmModal({ type: 'clear_all' })}
              className="px-4 py-2 bg-surface-container-highest hover:bg-error/20 hover:text-error text-on-surface rounded-xl font-label-md text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-outline-variant/30 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">cleaning_services</span>
              Clear All Documents
            </button>
          )}

          <button
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            Upload New Document
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['All', 'Compliant', 'Risk Flagged'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents or entities..."
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-1.5 pl-9 pr-4 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant/20 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-on-surface">
            <thead className="bg-surface-container-low/80 text-on-surface-variant uppercase font-mono font-semibold text-[10px] tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredDocs.length > 0 && selectedDocIds.length === filteredDocs.length}
                    onChange={handleSelectAll}
                    className="accent-primary w-4 h-4 rounded cursor-pointer"
                  />
                </th>
                <th className="p-4">Document Name</th>
                <th className="p-4">Framework</th>
                <th className="p-4">Compliance Status</th>
                <th className="p-4">Score</th>
                <th className="p-4">Confidence</th>
                <th className="p-4">Extracted Entities</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredDocs.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <tr
                    key={doc.id}
                    className={`hover:bg-surface-container-highest/40 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(doc.id)}
                        className="accent-primary w-4 h-4 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-medium">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-xl">
                          {doc.name.endsWith('.mp3') ? 'mic' : doc.name.endsWith('.docx') ? 'description' : 'picture_as_pdf'}
                        </span>
                        <div>
                          <div className="font-bold text-on-surface text-xs">{doc.name}</div>
                          <div className="text-[10px] text-outline font-mono">
                            UUID: {doc.uuid} • {doc.size}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-secondary text-xs">{doc.framework}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          doc.status === 'Compliant'
                            ? 'bg-tertiary/10 text-tertiary border-tertiary/30'
                            : 'bg-error/10 text-error border-error/30'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-sm">{doc.riskScore || (doc.status === 'Compliant' ? 'A+' : 'C-')}</td>
                    <td className="p-4 font-mono text-tertiary font-bold">{doc.confidence}%</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(doc.entities || []).map((ent, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant text-[10px] rounded border border-outline-variant/30 font-mono"
                          >
                            {ent}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onNavigate('explorer')}
                          className="px-3 py-1 bg-surface-container-highest hover:bg-surface-container-high text-on-surface rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Explore Graph
                        </button>
                        <button
                          onClick={() => onNavigate('chat')}
                          className="px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          AI Audit
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => setConfirmModal({ type: 'single', docId: doc.id, docName: doc.name })}
                          className="px-2 py-1 text-error hover:bg-error/10 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete Document & Graph Elements"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="glass-card bg-surface-container-high max-w-md w-full rounded-2xl p-6 shadow-2xl border border-error/30">
            <div className="flex items-center gap-3 text-error mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-headline-md text-lg font-bold text-on-surface">
                {confirmModal.type === 'single' && 'Confirm Document Deletion'}
                {confirmModal.type === 'bulk' && `Delete ${selectedDocIds.length} Selected Documents?`}
                {confirmModal.type === 'clear_all' && 'Clear ALL System Documents?'}
              </h3>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              {confirmModal.type === 'single' &&
                `Are you sure you want to permanently delete "${confirmModal.docName}"? This will remove the file, extracted entities, relationships, Qdrant vectors, and Neo4j graph data.`}
              {confirmModal.type === 'bulk' &&
                `Are you sure you want to permanently delete these ${selectedDocIds.length} documents? All associated entities, vectors, and graph relationships will be purged.`}
              {confirmModal.type === 'clear_all' &&
                'Are you sure you want to permanently delete ALL uploaded documents from the system? This will clear all physical files, wipe Neo4j graph nodes/edges, and reset vector embeddings. User accounts, settings, and roles remain intact.'}
            </p>

            <div className="flex justify-end gap-3">
              <button
                disabled={isProcessing}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-surface-container-highest hover:bg-surface-container-high text-on-surface rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isProcessing}
                onClick={executeConfirmAction}
                className="px-4 py-2 bg-error text-on-error hover:brightness-110 rounded-xl font-semibold text-xs transition-all shadow-md shadow-error/20 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
