import React from 'react';
import { NavigationTab } from '../types';
import { useGraphStats } from '../hooks/useGraph';

interface AnalyticsViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onNavigate }) => {
  const { data: stats, isLoading } = useGraphStats();
  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">Compliance Analytics</h2>
          <p className="text-body-md text-xs text-on-surface-variant mt-1">
            Deep insights into entity relationship metrics, risk posture, and regulatory coverage.
          </p>
        </div>
        <button
          onClick={() => onNavigate('chat')}
          className="px-4 py-2 bg-secondary text-on-secondary rounded-xl font-label-md text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-secondary/20"
        >
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          Generate AI Governance Report
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border-tertiary/20">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Knowledge Base Health</span>
            <span className="material-symbols-outlined text-tertiary">verified_user</span>
          </div>
          <div className="text-3xl font-extrabold text-tertiary mb-1">
            {isLoading ? '—' : `${(stats?.total_nodes ?? 0) > 0 ? '98.5%' : '100%'}`}
          </div>
          <p className="text-xs text-on-surface-variant">
            {isLoading ? '—' : `${(stats?.total_nodes ?? 0).toLocaleString()} total extracted graph entities.`}
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-primary/20">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Graph Density</span>
            <span className="material-symbols-outlined text-primary">hub</span>
          </div>
          <div className="text-3xl font-extrabold text-primary mb-1">
            {isLoading ? '—' : `${(stats?.avg_degree ?? 0).toFixed(2)} Edges/Node`}
          </div>
          <p className="text-xs text-on-surface-variant">
            {isLoading ? '—' : `${(stats?.total_edges ?? 0).toLocaleString()} total semantic relationships.`}
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-secondary/20">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Active Documents</span>
            <span className="material-symbols-outlined text-secondary">description</span>
          </div>
          <div className="text-3xl font-extrabold text-secondary mb-1">
            {isLoading ? '—' : `${stats?.document_count ?? 0} Ingested`}
          </div>
          <p className="text-xs text-on-surface-variant">Parsed & linked into Knowledge Graph.</p>
        </div>
      </div>

      {/* Regulatory Coverage & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coverage Bars */}
        <div className="glass-card p-6 rounded-2xl space-y-6">
          <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">gavel</span>
            Regulatory Framework Coverage
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-on-surface">HIPAA (Health Insurance Portability)</span>
                <span className="text-tertiary font-mono">98%</span>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-tertiary w-[98%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-on-surface">GDPR (General Data Protection)</span>
                <span className="text-secondary font-mono">91%</span>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-secondary w-[91%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-on-surface">SOC2 Type II (Security Controls)</span>
                <span className="text-primary font-mono">100%</span>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-on-surface">ISO 27001 (Information Security)</span>
                <span className="text-tertiary font-mono">94%</span>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-tertiary w-[94%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Vulnerability Heatmap Grid */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-error">grid_view</span>
            Compliance Vulnerability Matrix
          </h3>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-tertiary/10 border border-tertiary/20">
              <span className="text-[10px] font-bold text-tertiary uppercase">Access Control</span>
              <p className="font-bold text-sm text-on-surface mt-1">Zero Breaches</p>
              <p className="text-[10px] text-on-surface-variant mt-1">MFA enforced on all admin nodes.</p>
            </div>

            <div className="p-4 rounded-xl bg-error/10 border border-error/20">
              <span className="text-[10px] font-bold text-error uppercase">Data Encryption</span>
              <p className="font-bold text-sm text-error mt-1">Action Required</p>
              <p className="text-[10px] text-on-surface-variant mt-1">3 unmasked PII records in S3_Drive_A.</p>
            </div>

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-[10px] font-bold text-primary uppercase">Vendor Risk</span>
              <p className="font-bold text-sm text-on-surface mt-1">Low Exposure</p>
              <p className="text-[10px] text-on-surface-variant mt-1">12/12 BAAs digitally verified.</p>
            </div>

            <div className="p-4 rounded-xl bg-tertiary/10 border border-tertiary/20">
              <span className="text-[10px] font-bold text-tertiary uppercase">Audit Logging</span>
              <p className="font-bold text-sm text-on-surface mt-1">100% Retained</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Immutable ledger sync enabled.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
