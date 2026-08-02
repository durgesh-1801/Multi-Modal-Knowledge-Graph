import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../hooks/useProjects';
import {
  useReports,
  useGenerateReport,
  useRegenerateReport,
  useDeleteReport,
  downloadReportPdf,
  ComplianceReportData,
} from '../hooks/useReport';

// ─── Severity & Badge Styling ──────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const FW_BADGE_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-violet-50 text-violet-700 border-violet-200',
];

// ─── KPI Tile ──────────────────────────────────────────────────────────────────
const KpiTile: React.FC<{
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}> = ({ label, value, icon, color, sub }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
    </div>
    <div className={`text-2xl font-extrabold ${color} leading-none my-2`}>{value}</div>
    {sub && <p className="text-[10px] text-slate-400 font-mono">{sub}</p>}
  </div>
);

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: string; title: string; badge?: string }> = ({ icon, title, badge }) => (
  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
    <span className="material-symbols-outlined text-blue-600 text-xl">{icon}</span>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    {badge && (
      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
        {badge}
      </span>
    )}
  </div>
);

// ─── SVG Live Charts Component ─────────────────────────────────────────────────
const LiveChartsView: React.FC<{ report: ComplianceReportData }> = ({ report }) => {
  const categories = (Object.entries(report.entity_categories || {}) as Array<[string, number]>).sort(([, a], [, b]) => b - a);
  const totalEnt = categories.reduce((acc, [, count]) => acc + count, 0) || 1;

  const riskData = [
    { label: 'Critical', count: report.critical_findings_count, color: '#ef4444' },
    { label: 'High', count: report.high_findings_count, color: '#f97316' },
    { label: 'Medium', count: report.medium_findings_count, color: '#f59e0b' },
    { label: 'Low', count: report.low_findings_count, color: '#10b981' },
  ];
  const maxRisk = Math.max(...riskData.map(r => r.count), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
      {/* 1. Entity Distribution Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-sm">bar_chart</span>
          Entity Type Breakdown (Neo4j)
        </h4>
        <div className="space-y-2.5">
          {categories.slice(0, 7).map(([cat, count]) => {
            const pct = Math.round((count / totalEnt) * 100);
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>{cat}</span>
                  <span className="font-mono text-blue-600 font-bold">{count} ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Risk Distribution Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-sm">pie_chart</span>
          Risk & Findings Distribution
        </h4>
        <div className="space-y-3">
          {riskData.map((item) => {
            const widthPct = Math.round((item.count / maxRisk) * 100);
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label} Severity
                  </span>
                  <span className="font-mono font-bold" style={{ color: item.color }}>{item.count} findings</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${widthPct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall Compliance Score Radial Gauge */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Overall Compliance Score</p>
            <p className="text-[10px] text-slate-500">Calculated from control & framework coverage</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black text-emerald-600">{report.overall_compliance_score}%</span>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full uppercase">
              Audit Grade
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Detailed Report Render ────────────────────────────────────────────────────
const FullReportView: React.FC<{ report: ComplianceReportData }> = ({ report }) => {
  const dateStr = new Date(report.generated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div id="audit-report-printable-area" className="space-y-8 text-slate-900 print:text-black">
      {/* ── COVER / HEADER PAGE ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden print:rounded-none print:bg-none print:text-black">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-white text-3xl">shield_with_heart</span>
            </div>
            <div>
              <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                Enterprise AI Compliance Engine
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold">{report.project_name}</h1>
              <p className="text-slate-300 text-xs mt-1">{report.project_description}</p>
            </div>
          </div>

          <div className="text-right space-y-1 text-xs font-mono">
            <p className="text-blue-200">{dateStr}</p>
            <p className="text-slate-400">Report ID: {report.id}</p>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              CONFIDENTIAL • AUDIT GRADE
            </span>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-xs">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Generated By</p>
            <p className="font-bold text-white">{report.generated_by}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Role</p>
            <p className="font-bold text-white">{report.generated_role}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Frameworks Detected</p>
            <p className="font-bold text-emerald-400">{report.detected_frameworks.length} Frameworks</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Compliance Score</p>
            <p className="font-bold text-emerald-400 text-sm">{report.overall_compliance_score}% Compliant</p>
          </div>
        </div>
      </div>

      {/* ── STEP 15 VALIDATION GATE BADGE ──────────────────────────────────── */}
      {report.validation_passed ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <div>
            <p className="text-xs font-bold text-emerald-900">Step 15 Validation Passed</p>
            <p className="text-[11px] text-emerald-700">
              7-point system integrity check verified: Document counts, Neo4j node/edge counts, entity totals, user identity, project ID, and framework counts match backend telemetry.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-lg mt-0.5">warning</span>
          <div>
            <p className="text-xs font-bold text-amber-900">Validation Notice</p>
            <ul className="mt-1 space-y-0.5">
              {report.validation_notes.map((n, i) => (
                <li key={i} className="text-[11px] text-amber-800">• {n}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── SYSTEM OVERVIEW METRICS (STEP 4) ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="monitoring" title="Live System Metrics (Step 4)" badge="Backend Telemetry" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Uploaded Documents" value={report.total_documents} icon="description" color="text-blue-600" sub="Total files" />
          <KpiTile label="Parsed Documents" value={report.processed_documents} icon="task_alt" color="text-emerald-600" sub="Successfully ingested" />
          <KpiTile label="Risk Flagged" value={report.failed_documents} icon="flag" color="text-orange-500" sub="Require review" />
          <KpiTile label="Avg Confidence" value={`${report.avg_confidence}%`} icon="verified" color="text-indigo-600" sub="Extraction score" />
          <KpiTile label="Entities" value={report.entities_count.toLocaleString()} icon="hub" color="text-purple-600" sub="Extracted nodes" />
          <KpiTile label="Relationships" value={report.relationships_count.toLocaleString()} icon="share" color="text-blue-500" sub="Graph edges" />
          <KpiTile label="Neo4j Nodes" value={report.neo4j_nodes.toLocaleString()} icon="account_tree" color="text-violet-600" sub="Graph database" />
          <KpiTile label="Neo4j Edges" value={report.neo4j_relationships.toLocaleString()} icon="cable" color="text-sky-600" sub="Database edges" />
          <KpiTile label="Vector Count" value={report.qdrant_vector_count.toLocaleString()} icon="auto_awesome" color="text-teal-600" sub="Qdrant embeddings" />
          <KpiTile label="Graph Density" value={report.graph_density.toFixed(4)} icon="bubble_chart" color="text-rose-600" sub="Edge-node ratio" />
          <KpiTile label="Avg Degree" value={`${report.avg_degree} edges/node`} icon="scatter_plot" color="text-amber-600" sub="Connectivity index" />
          <KpiTile label="Processing Time" value={report.avg_processing_time} icon="speed" color="text-slate-600" sub={`Model: ${report.embedding_model}`} />
        </div>
      </div>

      {/* ── AI EXECUTIVE SUMMARY (STEP 5) ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="summarize" title="AI Executive Summary (Step 5)" badge="Graph RAG" />
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {report.executive_summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
            <p className="text-xs font-bold text-blue-900 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-600">thumb_up</span>
              Compliance Strengths
            </p>
            <p className="text-xs text-blue-800 leading-relaxed">
              High entity coverage across {report.detected_frameworks.length} detected security frameworks with robust Neo4j graph relationships.
            </p>
          </div>
          <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
            <p className="text-xs font-bold text-orange-900 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-orange-600">warning</span>
              Key Vulnerabilities
            </p>
            <p className="text-xs text-orange-800 leading-relaxed">
              {report.critical_findings_count} critical and {report.high_findings_count} high-severity findings requiring immediate remediation.
            </p>
          </div>
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
            <p className="text-xs font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">recommend</span>
              Governance Roadmap
            </p>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Enforce access controls, identity verification, and encryption policies according to recommendations below.
            </p>
          </div>
        </div>
      </div>

      {/* ── COMPLIANCE DASHBOARD & LIVE CHARTS (STEP 14) ────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="analytics" title="Live Compliance Dashboard & Visualizations (Step 14)" badge="Live Data" />
        <LiveChartsView report={report} />
      </div>

      {/* ── FRAMEWORK DETECTION (STEP 3) ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="policy" title="Detected Compliance Frameworks (Step 3)" badge={`${report.detected_frameworks.length} Detected`} />
        <div className="flex flex-wrap gap-3">
          {report.detected_frameworks.map((fw, i) => (
            <div key={fw} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold ${FW_BADGE_COLORS[i % FW_BADGE_COLORS.length]}`}>
              <span className="material-symbols-outlined text-sm">verified_user</span>
              {fw}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Frameworks automatically detected from uploaded document contents and knowledge graph entity definitions.
        </p>
      </div>

      {/* ── ENTITY ANALYSIS (STEP 7) ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="category" title="Entity Analysis & Categories (Step 7)" badge="Exact Real Counts" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(report.entity_categories).map(([type, count]) => {
            const pct = report.entity_percentages[type] ?? 0;
            return (
              <div key={type} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800">{type}</span>
                  <span className="text-xs font-mono font-bold text-blue-600">{count}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{pct}% of total entities</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KNOWLEDGE GRAPH SUMMARY (STEP 8) ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="account_tree" title="Knowledge Graph Summary (Step 8)" badge="Neo4j Topities" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Connected Nodes */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Top Connected Graph Entities</h4>
            <div className="space-y-2">
              {report.top_connected_nodes.slice(0, 6).map((node, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-800">{node.name}</span>
                  <span className="font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-bold">
                    {node.degree} edges
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Referenced Controls & Policies */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Most Referenced Controls</h4>
              <div className="flex flex-wrap gap-1.5">
                {report.most_referenced_controls.map((ctrl, i) => (
                  <span key={i} className="text-xs font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                    {ctrl}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Most Referenced Policies</h4>
              <div className="flex flex-wrap gap-1.5">
                {report.most_referenced_policies.map((pol, i) => (
                  <span key={i} className="text-xs font-bold font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg">
                    {pol}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── COMPLIANCE SCORING (STEP 9) ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="score" title="Dynamic Compliance Scoring (Step 9)" badge="Mathematical Model" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Overall Score</p>
            <p className="text-3xl font-black text-emerald-700 mt-1">{report.overall_compliance_score}%</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-center">
            <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Framework Coverage</p>
            <p className="text-3xl font-black text-blue-700 mt-1">{report.framework_coverage_pct}%</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-center">
            <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Control Coverage</p>
            <p className="text-3xl font-black text-purple-700 mt-1">{report.control_coverage_pct}%</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 text-center">
            <p className="text-[10px] text-orange-700 font-bold uppercase tracking-wider">Risk Deduction</p>
            <p className="text-3xl font-black text-orange-700 mt-1">-{report.risk_score} pts</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
          Methodology: {report.scoring_methodology}
        </p>
      </div>

      {/* ── AI FINDINGS (STEP 6) ────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="security" title="AI Compliance Findings (Step 6)" badge={`${report.findings.length} Findings`} />
        <div className="space-y-4">
          {report.findings.map((f, i) => (
            <div key={i} className={`p-4 rounded-2xl border ${SEV_COLOR[f.severity]}`}>
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${SEV_DOT[f.severity]}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold">{f.title}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${SEV_COLOR[f.severity]}`}>
                      {f.severity}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Conf: {f.confidence}%
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{f.description}</p>
                  {f.evidence && (
                    <p className="text-[11px] mt-2 font-mono bg-white/70 p-2 rounded-lg border border-slate-200">
                      <strong>Evidence:</strong> {f.evidence}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECOMMENDATIONS & EVIDENCE (STEP 10 & STEP 11) ─────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="lightbulb" title="Actionable AI Recommendations & Evidence (Step 10 & 11)" badge="Evidence Grounded" />
        <div className="space-y-4">
          {report.recommendations.map((rec, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border flex-shrink-0 mt-0.5 ${SEV_COLOR[rec.priority]}`}>
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{rec.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">{rec.reason}</p>

                  {rec.evidence && (
                    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1 text-[11px] text-slate-600 font-mono">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">find_in_page</span>
                        Evidence Extraction (Step 11)
                      </p>
                      <p><strong>Document:</strong> {rec.evidence.document_name} (Page {rec.evidence.page_number})</p>
                      <p><strong>Section:</strong> {rec.evidence.section}</p>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 italic">
                        "{rec.evidence.extract}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SOURCE CITATIONS (STEP 12) ──────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="bookmark" title="Source Citations (Step 12)" badge="Traceable Grounding" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Document</th>
                <th className="pb-2">Page</th>
                <th className="pb-2">Control ID</th>
                <th className="pb-2">Framework</th>
                <th className="pb-2">Section</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {report.citations.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2.5 font-sans font-bold text-slate-800">{c.document_name}</td>
                  <td className="py-2.5 text-slate-600">Page {c.page_number}</td>
                  <td className="py-2.5 text-blue-600 font-bold">{c.control_id}</td>
                  <td className="py-2.5 text-purple-600 font-bold">{c.framework}</td>
                  <td className="py-2.5 text-slate-500">{c.section}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DOCUMENT INVENTORY ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <SectionHeader icon="folder_open" title="Ingested Document Inventory" badge={`${report.documents.length} Files`} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Filename</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Size</th>
                <th className="pb-2">Entities Linked</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-bold text-slate-800 max-w-xs truncate">{doc.name}</td>
                  <td className="py-2.5 uppercase font-mono text-[10px] text-slate-500">{doc.type}</td>
                  <td className="py-2.5 font-mono text-slate-600">{doc.file_size}</td>
                  <td className="py-2.5 font-mono text-purple-600 font-bold">{doc.node_count} nodes</td>
                  <td className="py-2.5 font-mono font-bold text-emerald-600">{doc.confidence}%</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${doc.status === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {doc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REPORT FOOTER ───────────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white print:rounded-none">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <div>
            <p className="font-bold text-slate-200">Generated by Enterprise AI Compliance Engine</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Powered by FastAPI · Neo4j Knowledge Graph · Qdrant Vector Store · Graph RAG Engine
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-mono">
            <p>Confidential Audit Document • Project: {report.project_name}</p>
            <p>Generated: {dateStr}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Compliance Reports View Component ───────────────────────────────────
export const ReportsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Set default project ID once projects load
  React.useEffect(() => {
    if (projects.length > 0 && (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId))) {
      setSelectedProjectId(projects[0].id);
    } else if (!selectedProjectId) {
      setSelectedProjectId('proj_compliance_2026');
    }
  }, [projects, selectedProjectId]);

  const { reports, isLoading: reportsLoading, refetch } = useReports(
    selectedProjectId || 'proj_compliance_2026',
    selectedFramework,
    searchQuery,
    sortBy
  );

  const generateMutation = useGenerateReport();
  const regenerateMutation = useRegenerateReport();
  const deleteMutation = useDeleteReport();

  const [activeReport, setActiveReport] = useState<ComplianceReportData | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  const debugSteps = [
    'Generating report...',
    'Collecting PostgreSQL metadata...',
    'Collecting Neo4j statistics...',
    'Collecting Qdrant metadata...',
    'Running Graph RAG...',
    'Generating PDF...',
    'Saving report...',
    'Saving PDF...',
    'Refreshing report list...',
    'Done.',
  ];

  const handleGenerate = async () => {
    const targetProjId = selectedProjectId || (projects.length > 0 ? projects[0].id : 'proj_compliance_2026');
    if (!targetProjId) return;
    setActiveStepIndex(0);
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < 9 ? prev + 1 : prev));
    }, 600);

    try {
      const newReport = await generateMutation.mutateAsync(targetProjId);
      clearInterval(interval);
      setActiveStepIndex(9);
      setActiveReport(newReport);
      refetch();
    } catch (err: any) {
      clearInterval(interval);
      alert(`Report Generation Error: ${err?.message || err}`);
    }
  };

  const handleRegenerate = async (reportId: string, projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const regenerated = await regenerateMutation.mutateAsync({ reportId, projectId });
      setActiveReport(regenerated);
      refetch();
    } catch (err: any) {
      alert(`Report Regeneration Error: ${err?.message || err}`);
    }
  };

  const handleDelete = async (reportId: string, projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this compliance report?')) {
      await deleteMutation.mutateAsync({ reportId, projectId });
      if (activeReport?.id === reportId) {
        setActiveReport(null);
      }
      refetch();
    }
  };

  const handleDownloadPdf = async (reportId: string, projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await downloadReportPdf(reportId, projectId);
  };

  const handleClearAll = async () => {
    if (!selectedProjectId || reports.length === 0) return;
    if (!window.confirm(`Are you sure you want to clear all ${reports.length} compliance report(s) for this project? This action cannot be undone.`)) return;
    for (const rep of reports) {
      try {
        await deleteMutation.mutateAsync({ reportId: rep.id, projectId: selectedProjectId });
      } catch (err) {
        console.error(`Failed to delete report ${rep.id}:`, err);
      }
    }
    setActiveReport(null);
    refetch();
  };

  const handlePrint = () => {
    window.print();
  };

  const activeProj = projects.find((p) => p.id === selectedProjectId) || (projects.length > 0 ? projects[0] : null);
  const activeProjName = activeProj?.name || (selectedProjectId ? selectedProjectId : 'selected project');

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Printable CSS override */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #audit-report-printable-area, #audit-report-printable-area * { visibility: visible !important; }
          #audit-report-printable-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Header & Project Selection Bar ──────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Enterprise Compliance Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Unified single-source-of-truth backend compliance reports powered by PostgreSQL, Neo4j, Qdrant, and Graph RAG.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="material-symbols-outlined text-sm text-blue-600">folder</span>
            <span className="font-bold text-slate-700">Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setActiveReport(null);
              }}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear All Reports Button */}
          {reports.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 border border-red-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Delete all generated compliance reports for this project"
            >
              <span className="material-symbols-outlined text-base">delete_sweep</span>
              {deleteMutation.isPending ? 'Clearing…' : 'Clear All Reports'}
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            {generateMutation.isPending ? 'Generating Report…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ── SEARCH, FILTER & SORT CONTROLS BAR ──────────────────────────────── */}
      {!activeReport && !generateMutation.isPending && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search by project name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Framework Filter */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="material-symbols-outlined text-sm text-purple-600">verified_user</span>
              <span className="font-bold text-slate-700">Framework:</span>
              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">All Frameworks</option>
                <option value="NIST SP 800-53">NIST SP 800-53</option>
                <option value="ISO 27001">ISO 27001</option>
                <option value="GDPR">GDPR</option>
                <option value="HIPAA">HIPAA</option>
                <option value="SOC 2">SOC 2</option>
                <option value="Zero Trust">Zero Trust</option>
              </select>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="material-symbols-outlined text-sm text-slate-600">sort</span>
            <span className="font-bold text-slate-700">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="score">Highest Score</option>
            </select>
          </div>
        </div>
      )}

      {/* ── GENERATING OVERLAY WITH STEP LOGGING ─────────────────────────────── */}
      {generateMutation.isPending && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center gap-6 shadow-xs text-center no-print">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center animate-spin shadow-lg shadow-blue-600/30">
            <span className="material-symbols-outlined text-white text-3xl">autorenew</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Generating Dynamic Compliance Audit Report</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Running unified ReportGenerationService pipeline for project '{activeProjName}'...
            </p>
          </div>

          {/* Step Progress Display */}
          <div className="w-full max-w-md bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2 font-mono text-xs">
            {debugSteps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 transition-all ${
                  idx < activeStepIndex
                    ? 'text-emerald-600 font-bold'
                    : idx === activeStepIndex
                    ? 'text-blue-600 font-bold animate-pulse'
                    : 'text-slate-400'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {idx < activeStepIndex ? 'check_circle' : idx === activeStepIndex ? 'sync' : 'radio_button_unchecked'}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REPORTS LIST GRID ──────────────────────────────────────────────── */}
      {!activeReport && !generateMutation.isPending && (
        <div className="space-y-4 no-print">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Generated Audit Reports ({reports.length})
            </h3>
          </div>

          {reports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center text-center gap-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600 text-3xl">assessment</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">No Compliance Reports Found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {searchQuery || selectedFramework
                    ? 'No reports match your current search or framework filter parameters.'
                    : `Click 'Generate Report' above to assemble an audit report using live backend data from project '${activeProjName}'.`}
                </p>
              </div>
              <button
                onClick={handleGenerate}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                Generate Report Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((rep) => {
                const repDate = new Date(rep.generated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={rep.id}
                    onClick={() => setActiveReport(rep)}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                          {rep.id} • {repDate}
                        </span>
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rep.overall_compliance_score}% Score
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {rep.project_name} Compliance Audit Report
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rep.executive_summary}</p>
                    </div>

                    {/* Metadata summary & Framework Badges */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {rep.detected_frameworks.map((fw, idx) => (
                          <span key={idx} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {fw}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Docs</span>
                          <span className="font-bold text-slate-700">{rep.total_documents} Files</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Entities</span>
                          <span className="font-bold text-purple-700">{rep.entities_count}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Edges</span>
                          <span className="font-bold text-blue-700">{rep.relationships_count}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 font-mono">Generated by: {rep.generated_by}</p>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        {/* Download PDF Button */}
                        <button
                          onClick={(e) => handleDownloadPdf(rep.id, rep.project_id, e)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                          title="Download stored PDF report"
                        >
                          <span className="material-symbols-outlined text-xs text-red-600">picture_as_pdf</span>
                          <span>PDF</span>
                        </button>

                        {/* Regenerate Button */}
                        <button
                          onClick={(e) => handleRegenerate(rep.id, rep.project_id, e)}
                          disabled={regenerateMutation.isPending}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          title="Regenerate this compliance report"
                        >
                          <span className="material-symbols-outlined text-xs text-blue-600">refresh</span>
                          <span>Regenerate</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDelete(rep.id, rep.project_id, e)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete Report"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>

                        {/* View Report Button */}
                        <span className="text-blue-600 font-bold text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          View Report
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DETAILED AUDIT REPORT VIEW ───────────────────────────────────────── */}
      {activeReport && !generateMutation.isPending && (
        <div className="space-y-6">
          {/* View Toolbar */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 no-print">
            <button
              onClick={() => setActiveReport(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Reports List
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={(e) => handleDownloadPdf(activeReport.id, activeReport.project_id, e)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                Download Stored PDF
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print Report
              </button>
            </div>
          </div>

          <FullReportView report={activeReport} />
        </div>
      )}
    </div>
  );
};
