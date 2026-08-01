import React, { useState } from 'react';

export const SettingsView: React.FC = () => {
  const [frameworks, setFrameworks] = useState({
    hipaa: true,
    gdpr: true,
    soc2: true,
    iso27001: true,
    fincen: false,
  });

  const [autoMask, setAutoMask] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">System Settings & Frameworks</h2>
        <p className="text-body-md text-xs text-on-surface-variant mt-1">
          Manage regulatory frameworks, API server connections, and automated remediation preferences.
        </p>
      </div>

      {/* Regulatory Framework Toggles */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">gavel</span>
          Active Compliance Frameworks
        </h3>

        <div className="space-y-3 pt-2">
          {Object.entries({
            hipaa: 'HIPAA (Health Insurance Portability & Accountability Act)',
            gdpr: 'GDPR (EU General Data Protection Regulation)',
            soc2: 'SOC2 Type II (AICPA Trust Services Criteria)',
            iso27001: 'ISO 27001 (Information Security Management)',
            fincen: 'FinCEN (Financial Crimes Enforcement Network)',
          }).map(([key, label]) => (
            <div
              key={key}
              className="flex justify-between items-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/20"
            >
              <span className="text-xs font-semibold text-on-surface">{label}</span>
              <button
                onClick={() =>
                  setFrameworks((prev: any) => ({ ...prev, [key]: !prev[key as keyof typeof frameworks] }))
                }
                className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                  frameworks[key as keyof typeof frameworks] ? 'bg-primary justify-end' : 'bg-surface-container-highest justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-on-primary"></div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Automated Remediation Policy */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">auto_fix_high</span>
          Automated Governance & Remediation
        </h3>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div>
              <p className="text-xs font-semibold text-on-surface">Auto-Mask PII Fields</p>
              <p className="text-[10px] text-on-surface-variant">Automatically obscure SSNs and medical IDs during OCR extraction.</p>
            </div>
            <button
              onClick={() => setAutoMask(!autoMask)}
              className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                autoMask ? 'bg-tertiary justify-end' : 'bg-surface-container-highest justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-on-tertiary"></div>
            </button>
          </div>

          <div className="flex justify-between items-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div>
              <p className="text-xs font-semibold text-on-surface">Auto-Escalate Breach Risks</p>
              <p className="text-[10px] text-on-surface-variant">Notify Compliance Officers on high-risk relationship node creation.</p>
            </div>
            <button
              onClick={() => setAutoEscalate(!autoEscalate)}
              className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                autoEscalate ? 'bg-tertiary justify-end' : 'bg-surface-container-highest justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-on-tertiary"></div>
            </button>
          </div>
        </div>
      </div>

      {/* System Secrets & API Integration Status */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">key</span>
          API Keys & Server Configuration
        </h3>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <span className="text-xs font-mono text-on-surface font-bold">GEMINI_API_KEY</span>
            <span className="px-2.5 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full border border-tertiary/30">
              Active (Server-Side)
            </span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <span className="text-xs font-mono text-on-surface font-bold">GRAPH_STORAGE_ENGINE</span>
            <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/30">
              InMemory / Vector Index
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
