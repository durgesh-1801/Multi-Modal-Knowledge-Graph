import React from 'react';
import { useAuth } from '../context/AuthContext';

export const ReportsView: React.FC = () => {
  const { activeRole } = useAuth();

  const reports = [
    {
      id: 'rep_hipaa_q3',
      title: 'HIPAA Security Rule Audit Report Q3 2026',
      category: 'HIPAA Compliance',
      date: '2026-07-28',
      score: 'A+ (98.4%)',
      status: 'Passed',
      size: '2.4 MB',
      description: 'Comprehensive evaluation of Section 164.308 administrative safeguards and ePHI knowledge graph node integrity.',
    },
    {
      id: 'rep_gdpr_pii',
      title: 'GDPR Data Subject Right & PII Masking Audit',
      category: 'GDPR Compliance',
      date: '2026-07-15',
      score: 'A (94.1%)',
      status: 'Action Required',
      size: '4.1 MB',
      description: 'Analysis of entity normalization and automated masking of 14 unmasked PII instances in corporate knowledge nodes.',
    },
    {
      id: 'rep_soc2_type2',
      title: 'SOC 2 Type II Security & Confidentiality Audit',
      category: 'SOC 2 Certification',
      date: '2026-06-30',
      score: 'A+ (99.1%)',
      status: 'Certified',
      size: '5.8 MB',
      description: 'Full graph RAG query line-of-custody verification, vector store access control logs, and RBAC policy enforcement trace.',
    },
  ];

  const handleDownload = (reportTitle: string) => {
    alert(`Downloading enterprise compliance report: ${reportTitle}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Compliance Audit Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Download certified audit reports generated automatically from Knowledge Graph entity extractions and RAG citation traces.
          </p>
        </div>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 uppercase tracking-wider">
          Auditor Verified Data
        </span>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 gap-4">
        {reports.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">description</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {r.category}
                  </span>
                  <span className="text-xs font-bold text-slate-900">{r.score}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{r.title}</h3>
                <p className="text-xs text-slate-600 mt-1">{r.description}</p>
                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono mt-2">
                  <span>Generated: {r.date}</span>
                  <span>File Size: {r.size}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDownload(r.title)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
