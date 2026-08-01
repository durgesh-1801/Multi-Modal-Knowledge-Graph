import React, { useState } from 'react';
import { NavigationTab } from '../types';

interface DocumentsViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ onNavigate }) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const documents = [
    {
      id: 'doc-1',
      name: 'compliance_v2_final.pdf',
      uuid: '9a8b-11c2',
      size: '4.2 MB',
      updated: '3d ago',
      status: 'Compliant',
      riskScore: 'A+',
      confidence: 98,
      framework: 'HIPAA',
      entities: ['Compliance_Dept', 'Finance_Ops', 'GDPR_Art_12'],
    },
    {
      id: 'doc-2',
      name: 'Q3_Patient_Records.pdf',
      uuid: '4a2f-91c2',
      size: '12.8 MB',
      updated: '1d ago',
      status: 'Risk Flagged',
      riskScore: 'C-',
      confidence: 96,
      framework: 'HIPAA',
      entities: ['Patient_PHI', 'Vendor_CloudFlow', 'SSN_Unmasked'],
    },
    {
      id: 'doc-3',
      name: 'audit_report_q3.pdf',
      uuid: '8b11-5e34',
      size: '3.1 MB',
      updated: '2h ago',
      status: 'Compliant',
      riskScore: 'A',
      confidence: 94,
      framework: 'SOC2',
      entities: ['FinCEN', 'Risk_Registry', 'Access_Control'],
    },
    {
      id: 'doc-4',
      name: 'board_meeting_04.mp3',
      uuid: '2c55-7d1a',
      size: '24.5 MB',
      updated: '5h ago',
      status: 'Compliant',
      riskScore: 'B+',
      confidence: 92,
      framework: 'ISO 27001',
      entities: ['Acquisition', 'Strategy_Plan', 'Executive_Board'],
    },
    {
      id: 'doc-5',
      name: 'Shared_Drive_A_Dump.docx',
      uuid: '7f99-3d11',
      size: '8.4 MB',
      updated: '6h ago',
      status: 'Risk Flagged',
      riskScore: 'D+',
      confidence: 89,
      framework: 'GDPR',
      entities: ['PII_Records', 'Shared_Folder', 'Unmasked_Data'],
    },
  ];

  const filteredDocs = (documents || []).filter((doc) => {
    const matchesFilter = filterStatus === 'All' || doc.status === filterStatus;
    const matchesSearch =
      (doc.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.framework || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.entities || []).some((e) => (e || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

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
        <button
          onClick={() => onNavigate('upload')}
          className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-sm">cloud_upload</span>
          Upload New Document
        </button>
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
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-container-highest/40 transition-colors">
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
                  <td className="p-4 font-bold text-sm">{doc.riskScore}</td>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
