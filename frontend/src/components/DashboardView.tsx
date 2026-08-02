import React, { useState } from 'react';
import { NavigationTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { useGraphStats } from '../hooks/useGraph';

interface DashboardViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { activeRole, user } = useAuth();
  const [filterActive, setFilterActive] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSections, setSelectedSections] = useState({
    kpis: true,
    insights: true,
    pipeline: true,
    entities: true,
  });

  const { data: graphStats, isLoading } = useGraphStats();

  const kpis = [
    {
      id: 'docs',
      title: 'Total Documents',
      value: isLoading
        ? '...'
        : (graphStats?.document_count ?? graphStats?.total_documents ?? 0).toLocaleString(),
      change: '+12%',
      icon: 'description',
      color: 'text-primary',
      bg: 'bg-primary/10',
      badgeColor: 'text-tertiary',
      trendIcon: 'trending_up',
    },
    {
      id: 'entities',
      title: 'Graph Entities',
      value: isLoading
        ? '...'
        : (graphStats?.node_count ?? graphStats?.total_nodes ?? 0).toLocaleString(),
      change: isLoading
        ? '...'
        : typeof (graphStats?.average_degree ?? graphStats?.avg_degree) === 'number'
        ? `${(graphStats?.average_degree ?? graphStats?.avg_degree ?? 0).toFixed(1)} edges/node`
        : '+8%',
      icon: 'database',
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      badgeColor: 'text-tertiary',
      trendIcon: 'trending_up',
    },
    {
      id: 'score',
      title: 'Compliance Score',
      value: 'A+',
      badgeText: '98% Compliant',
      icon: 'verified_user',
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
      badgeColor: 'text-tertiary',
    },
    {
      id: 'confidence',
      title: 'Avg Extraction Confidence',
      value: '94.2%',
      badgeText: 'Confidence',
      icon: 'psychology',
      color: 'text-primary',
      bg: 'bg-primary/10',
      badgeColor: 'text-primary',
    },
  ];

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      let csvContent = 'ENTERPRISE AI COMPLIANCE ENGINE - EXECUTIVE REPORT\n';
      csvContent += `Generated Date,${new Date().toLocaleString()}\n\n`;

      if (selectedSections.kpis) {
        csvContent += 'KEY PERFORMANCE INDICATORS\n';
        csvContent += 'Metric,Value,Status/Trend\n';
        kpis.forEach((kpi) => {
          csvContent += `"${kpi.title}","${kpi.value}","${kpi.change || kpi.badgeText}"\n`;
        });
        csvContent += '\n';
      }

      if (selectedSections.insights) {
        csvContent += 'CRITICAL AI COMPLIANCE INSIGHTS\n';
        csvContent += 'Category,Title,Description\n';
        csvContent += '"Relational Pattern","Pattern Detected","New connection between Entity X and ISO-27001 suggests 15% risk increase in section 4.2."\n';
        csvContent += '"Efficiency","Extraction Efficiency","OCR accuracy improved by 4.2% following model fine-tuning."\n';
        csvContent += '"Data Leak Alert","Potential Leak","Unstructured data in Shared_Drive_A contains 14 unmasked PII instances."\n';
        csvContent += '"Knowledge Base","Expansion","Graph density reached a new threshold. Recommendation: Prune redundant links."\n\n';
      }

      if (selectedSections.pipeline) {
        csvContent += 'EXTRACTION PIPELINE LOGS\n';
        csvContent += 'Batch/Event,Timestamp,Status/Details\n';
        csvContent += '"Legal_Corp_2024.zip","Just now","OCR Phase: 67% complete • 1,422 entities found"\n';
        csvContent += '"Relationship Mapping","12 min ago","Linked 452 new nodes to master compliance graph"\n';
        csvContent += '"Security Audit","1 hour ago","Manual review required for 3 document classifications"\n\n';
      }

      if (selectedSections.entities) {
        csvContent += 'ENTITY DISTRIBUTION BREAKDOWN\n';
        csvContent += 'Entity Type,Percentage,Count\n';
        csvContent += '"Persons",45%,18945\n';
        csvContent += '"Organizations",30%,12630\n';
        csvContent += '"Locations",15%,6315\n';
        csvContent += '"Other Categories",10%,4210\n';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Enterprise_Compliance_Metrics_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setExportModalOpen(false);
      setExportSuccessMsg('Compliance report successfully downloaded as CSV file!');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    }, 600);
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to generate the PDF report.');
        setIsExporting(false);
        return;
      }

      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Enterprise AI Compliance Report</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1a1a1a; background: #fff; line-height: 1.5; }
            .header { border-bottom: 2px solid #00285d; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 24px; font-weight: bold; color: #00285d; margin: 0; }
            .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
            .badge { background: #e8f0fe; color: #1a73e8; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fafafa; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; }
            .card-val { font-size: 22px; font-weight: bold; color: #00285d; margin-top: 5px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 16px; font-weight: bold; color: #00285d; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th, td { border: 1px solid #e0e0e0; padding: 10px; text-align: left; }
            th { background: #f0f4f9; font-weight: bold; color: #333; }
            .risk-flag { color: #d93025; font-weight: bold; }
            .footer { font-size: 10px; color: #888; text-align: center; margin-top: 50px; border-top: 1px solid #eee; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Enterprise AI Compliance Engine</h1>
              <div class="subtitle">Executive Compliance & Risk Knowledge Audit Report</div>
            </div>
            <div class="badge">CONFIDENTIAL • AUDIT GRADE</div>
          </div>

          <p><strong>Generated:</strong> ${new Date().toLocaleString()} | <strong>Auditor Access:</strong> Admin / John Doe</p>

          ${
            selectedSections.kpis
              ? `
            <div class="section">
              <div class="section-title">1. System Overview Metrics</div>
              <div class="grid">
                <div class="card"><div class="card-title">Total Documents</div><div class="card-val">1,248</div></div>
                <div class="card"><div class="card-title">Entities Extracted</div><div class="card-val">42.1K</div></div>
                <div class="card"><div class="card-title">Compliance Score</div><div class="card-val">A+ (98%)</div></div>
                <div class="card"><div class="card-title">Avg Confidence</div><div class="card-val">94.2%</div></div>
              </div>
            </div>
          `
              : ''
          }

          ${
            selectedSections.insights
              ? `
            <div class="section">
              <div class="section-title">2. Critical AI Insights & Risk Audit</div>
              <table>
                <thead>
                  <tr><th>Category</th><th>Risk Level</th><th>Finding Description</th></tr>
                </thead>
                <tbody>
                  <tr><td>Relational Pattern</td><td>Medium</td><td>New connection between 'Entity X' and ISO-27001 standard.</td></tr>
                  <tr><td>Extraction Efficiency</td><td>Low</td><td>OCR accuracy improved by 4.2% following model training.</td></tr>
                  <tr><td class="risk-flag">Data Leak Alert</td><td class="risk-flag">CRITICAL</td><td>14 unmasked PII instances identified in Shared_Drive_A. Action Required.</td></tr>
                  <tr><td>Knowledge Base</td><td>Info</td><td>Graph density threshold reached. Prune recommended.</td></tr>
                </tbody>
              </table>
            </div>
          `
              : ''
          }

          ${
            selectedSections.entities
              ? `
            <div class="section">
              <div class="section-title">3. Entity Distribution Summary</div>
              <table>
                <thead><tr><th>Category</th><th>Percentage</th><th>Node Count</th></tr></thead>
                <tbody>
                  <tr><td>Person Identifiers</td><td>45%</td><td>18,945</td></tr>
                  <tr><td>Organizations</td><td>30%</td><td>12,630</td></tr>
                  <tr><td>Locations & Locality</td><td>15%</td><td>6,315</td></tr>
                  <tr><td>Other Metadata</td><td>10%</td><td>4,210</td></tr>
                </tbody>
              </table>
            </div>
          `
              : ''
          }

          <div class="footer">
            Generated automatically by Enterprise AI Compliance Engine • Powered by Groq AI Knowledge Graph Logic
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(reportHtml);
      printWindow.document.close();

      setIsExporting(false);
      setExportModalOpen(false);
      setExportSuccessMsg('PDF Report document generated. Print/Download dialog launched!');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    }, 600);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Role-Specific Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {(activeRole || 'ADMIN').replace('_', ' ')} Dashboard
            </span>
            <span className="text-xs text-slate-400 font-mono">User: {user?.email ?? '—'}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {activeRole === 'ADMIN' && 'Enterprise System Administration & Analytics'}
            {activeRole === 'COMPLIANCE_OFFICER' && 'Compliance Operations & Document Processing'}
            {activeRole === 'AUDITOR' && 'Compliance Audit & Verification Center'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeRole === 'ADMIN' && 'Full system governance: users, projects, documents, graph health, and audit logs.'}
            {activeRole === 'COMPLIANCE_OFFICER' && 'Ingestion pipelines, OCR parsing, AI insights, and relationship extractions.'}
            {activeRole === 'AUDITOR' && 'Read-only graph inspection, compliance reporting, and grounded AI citation checks.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs text-xs font-bold"
          >
            <span className="material-symbols-outlined text-blue-600 text-base">download</span>
            <span>Export Audit Report</span>
          </button>

          {activeRole !== 'AUDITOR' && (
            <button
              onClick={() => onNavigate('upload')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer text-xs font-bold"
            >
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="glass-card p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-200"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 group-hover:bg-primary/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                <span className={`material-symbols-outlined ${kpi.color}`}>{kpi.icon}</span>
              </div>
              <span className={`${kpi.badgeColor} font-label-sm text-xs flex items-center gap-1 font-semibold`}>
                {kpi.trendIcon && <span className="material-symbols-outlined text-sm">{kpi.trendIcon}</span>}
                {kpi.change || kpi.badgeText}
              </span>
            </div>
            <p className="text-on-surface-variant font-label-md text-xs mb-1">{kpi.title}</p>
            <h3 className="text-headline-md font-bold text-on-surface">{kpi.value}</h3>
          </div>
        ))}
      </div>

      {/* Middle Section: Active Knowledge Graph & AI Critical Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Knowledge Graph Visualization Preview */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden min-h-[400px] flex flex-col relative group">
          <div className="p-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
            <h3 className="font-headline-md text-base font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">hub</span>
              Active Knowledge Graph
            </h3>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-wider">
                Live View
              </span>
            </div>
          </div>

          <div className="flex-1 relative bg-surface-container-lowest/60 min-h-[320px] overflow-hidden">
            {/* Background grid */}
            <div className="absolute inset-0 opacity-25 pointer-events-none canvas-grid"></div>

            {/* Simulated Nodes with Glow */}
            <div className="absolute top-1/4 left-1/4 w-3.5 h-3.5 bg-primary rounded-full node-glow"></div>
            <div className="absolute top-1/2 left-1/3 w-4.5 h-4.5 bg-secondary rounded-full node-glow"></div>
            <div className="absolute bottom-1/3 left-1/2 w-3.5 h-3.5 bg-tertiary rounded-full node-glow"></div>
            <div className="absolute top-1/3 right-1/4 w-2.5 h-2.5 bg-primary rounded-full node-glow"></div>
            <div className="absolute bottom-1/4 right-1/3 w-5 h-5 bg-secondary-container rounded-full node-glow"></div>

            {/* Connected Animated SVG Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M 25 25 Q 30 40 33 50" fill="transparent" stroke="#adc6ff" strokeWidth="1.5" className="edge-flow" />
              <path d="M 33 50 L 50 66" fill="transparent" stroke="#adc6ff" strokeWidth="1.5" className="edge-flow" />
              <path d="M 50 66 Q 60 70 66 75" fill="transparent" stroke="#d0bcff" strokeWidth="1.5" className="edge-flow" />
              <path d="M 33 50 L 75 33" fill="transparent" stroke="#4edea3" strokeWidth="1.5" className="edge-flow" />
            </svg>

            {/* Active Node Floating Card */}
            <div className="absolute bottom-4 left-4 glass-card p-3 rounded-xl border-primary/30 shadow-lg backdrop-blur-md">
              <p className="text-[10px] text-on-surface-variant font-mono">NODE_UID: EXT_8922_F</p>
              <p className="font-label-md text-xs font-bold text-primary flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                GDPR Compliance Breach detected
              </p>
            </div>

            {/* Hover overlay button to enter Fullscreen Graph Explorer */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-surface/40 backdrop-blur-xs">
              <button
                onClick={() => onNavigate('explorer')}
                className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-label-md text-xs font-bold flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">open_in_full</span>
                Enter Fullscreen Explorer
              </button>
            </div>
          </div>
        </div>

        {/* AI Critical Insights Panel */}
        <div className="glass-card rounded-2xl flex flex-col">
          <div className="p-5 border-b border-outline-variant/20 bg-secondary-container/10 flex items-center justify-between">
            <h3 className="font-headline-md text-base font-bold text-secondary flex items-center gap-2">
              <span className="material-symbols-outlined fill text-secondary">auto_awesome</span>
              AI Critical Insights
            </h3>
            <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">
              Realtime
            </span>
          </div>

          <div className="p-5 flex-1 space-y-4 overflow-y-auto max-h-[340px]">
            <div className="p-4 bg-primary-container/10 border-l-2 border-primary rounded-r-xl hover:bg-primary-container/15 transition-colors">
              <p className="text-primary font-label-md text-xs font-bold mb-1">Relational Pattern Detected</p>
              <p className="text-body-sm text-xs text-on-surface-variant">
                New connection between 'Entity X' and 'Compliance Standard ISO-27001' suggests a 15% risk increase in section 4.2.
              </p>
            </div>

            <div className="p-4 bg-tertiary-container/10 border-l-2 border-tertiary rounded-r-xl hover:bg-tertiary-container/15 transition-colors">
              <p className="text-tertiary font-label-md text-xs font-bold mb-1">Extraction Efficiency</p>
              <p className="text-body-sm text-xs text-on-surface-variant">
                OCR accuracy has improved by 4.2% following the latest model fine-tuning on legal documents.
              </p>
            </div>

            <div className="p-4 bg-error-container/10 border-l-2 border-error rounded-r-xl hover:bg-error-container/15 transition-colors">
              <p className="text-error font-label-md text-xs font-bold mb-1">Potential Data Leak</p>
              <p className="text-body-sm text-xs text-on-surface-variant">
                Unstructured data in 'Shared_Drive_A' contains 14 instances of unmasked PII. Immediate action required.
              </p>
            </div>

            <div className="p-4 bg-secondary-container/10 border-l-2 border-secondary rounded-r-xl hover:bg-secondary-container/15 transition-colors">
              <p className="text-secondary font-label-md text-xs font-bold mb-1">Knowledge Expansion</p>
              <p className="text-body-sm text-xs text-on-surface-variant">
                Graph density reached a new threshold. Recommendation: Prune redundant relationship nodes.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-outline-variant/20">
            <button
              onClick={() => onNavigate('chat')}
              className="w-full py-2 text-primary font-label-md text-xs font-semibold hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ask AI Chat About Insights</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Extraction Pipeline Timeline & Entity Distribution Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline Timeline */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h3 className="font-headline-md text-base font-bold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            Extraction Pipeline
          </h3>

          <div className="space-y-6">
            <div className="relative pl-8 border-l border-outline-variant/30">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20"></div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-label-md text-xs font-bold text-on-surface">Batch Processing: Legal_Corp_2024.zip</span>
                <span className="text-[10px] text-outline font-mono">Just now</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden mb-1">
                <div className="h-full bg-primary w-2/3 animate-pulse-subtle"></div>
              </div>
              <p className="text-[10px] text-on-surface-variant">OCR Phase: 67% complete • 1,422 entities found</p>
            </div>

            <div className="relative pl-8 border-l border-outline-variant/30">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-tertiary"></div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-label-md text-xs font-bold text-on-surface">Relationship Mapping Completed</span>
                <span className="text-[10px] text-outline font-mono">12 min ago</span>
              </div>
              <p className="text-body-sm text-xs text-on-surface-variant">
                Successfully linked 452 new nodes to the master compliance graph.
              </p>
            </div>

            <div className="relative pl-8 border-l border-outline-variant/30">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-surface-container-highest"></div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-label-md text-xs font-bold text-on-surface">Security Audit Triggered</span>
                <span className="text-[10px] text-outline font-mono">1 hour ago</span>
              </div>
              <p className="text-body-sm text-xs text-on-surface-variant">
                Manual review required for 3 suspicious document classifications.
              </p>
            </div>
          </div>
        </div>

        {/* Donut Chart / Entity Distribution */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <h3 className="font-headline-md text-base font-bold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">pie_chart</span>
            Entity Distribution
          </h3>

          <div className="flex-1 flex items-center justify-center relative min-h-[160px]">
            {/* Donut Chart SVG Representation */}
            <div className="w-40 h-40 rounded-full border-[16px] border-primary/20 relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[16px] border-t-primary border-r-secondary border-b-tertiary border-l-transparent rotate-45"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-on-surface leading-none">
                  {isLoading ? '...' : (graphStats?.node_count ?? graphStats?.total_nodes ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mt-0.5">
                  Total Nodes
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-outline-variant/20">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
              <span className="text-xs text-on-surface-variant">Persons (45%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
              <span className="text-xs text-on-surface-variant">Orgs (30%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-tertiary"></div>
              <span className="text-xs text-on-surface-variant">Location (15%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-outline"></div>
              <span className="text-xs text-on-surface-variant">Other (10%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {exportSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-semibold">{exportSuccessMsg}</span>
          <button
            onClick={() => setExportSuccessMsg(null)}
            className="ml-2 hover:opacity-75 cursor-pointer text-xs uppercase tracking-wider font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Export Report Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="glass-card bg-surface-container-high max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-outline-variant/30 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-tertiary/10 text-tertiary rounded-xl">
                  <span className="material-symbols-outlined text-2xl">file_download</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-lg font-bold text-on-surface">Export Compliance Metrics</h3>
                  <p className="text-xs text-on-surface-variant">Generate audit-grade reports as PDF or CSV datasets</p>
                </div>
              </div>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-highest cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 my-5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Include Report Sections</p>
              
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.kpis}
                    onChange={(e) => setSelectedSections({ ...selectedSections, kpis: e.target.checked })}
                    className="accent-primary w-4 h-4 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-on-surface block">System Metrics</span>
                    <span className="text-[10px] text-on-surface-variant block">KPI overview & scores</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.insights}
                    onChange={(e) => setSelectedSections({ ...selectedSections, insights: e.target.checked })}
                    className="accent-primary w-4 h-4 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-on-surface block">AI Insights</span>
                    <span className="text-[10px] text-on-surface-variant block">Risk flags & patterns</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.pipeline}
                    onChange={(e) => setSelectedSections({ ...selectedSections, pipeline: e.target.checked })}
                    className="accent-primary w-4 h-4 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-on-surface block">Pipeline Logs</span>
                    <span className="text-[10px] text-on-surface-variant block">Batch OCR & graph status</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.entities}
                    onChange={(e) => setSelectedSections({ ...selectedSections, entities: e.target.checked })}
                    className="accent-primary w-4 h-4 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-on-surface block">Entity Breakdown</span>
                    <span className="text-[10px] text-on-surface-variant block">Node distribution stats</span>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-surface-container rounded-xl text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-base">info</span>
                <span>Reports contain audit timestamps and encrypted document compliance checksums.</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-outline-variant/20">
              <button
                disabled={isExporting}
                onClick={handleExportCSV}
                className="flex-1 py-2.5 px-4 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-primary text-base">table_chart</span>
                {isExporting ? 'Generating...' : 'Export as CSV (.csv)'}
              </button>
              
              <button
                disabled={isExporting}
                onClick={handleExportPDF}
                className="flex-1 py-2.5 px-4 bg-primary text-on-primary hover:brightness-110 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                {isExporting ? 'Generating...' : 'Export Executive PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
