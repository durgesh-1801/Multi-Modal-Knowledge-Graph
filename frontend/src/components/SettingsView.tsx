import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { Toast, useToast } from './Toast';
import { apiClient, getErrorMessage } from '../lib/api';

interface LLMHealthStatus {
  provider: string;
  model: string;
  status: string;
  latency_ms: number;
}

export const SettingsView: React.FC = () => {
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'ADMIN';
  const { toast, showToast, dismissToast } = useToast();

  // ── Fetch settings from backend ───────────────────────────────────────────
  const { data: settings, isLoading } = useSettings();
  const { mutateAsync: updateSettings, isPending: isSaving } = useUpdateSettings();

  // ── LLM Health Status ─────────────────────────────────────────────────────
  const [llmHealth, setLlmHealth] = useState<LLMHealthStatus | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);

  // ── Local form state ──────────────────────────────────────────────────────
  const [llmProvider, setLlmProvider] = useState('Groq Llama-3.3 70B Versatile');
  const [neo4jUri, setNeo4jUri] = useState('bolt://localhost:7687');
  const [qdrantUrl, setQdrantUrl] = useState('http://localhost:6333');
  const [embeddingModel, setEmbeddingModel] = useState('all-MiniLM-L6-v2');
  const [theme, setTheme] = useState('light');
  const [securityAuditMode, setSecurityAuditMode] = useState(true);

  const [frameworks, setFrameworks] = useState({
    hipaa: true,
    gdpr: true,
    soc2: true,
    iso27001: true,
    fincen: false,
  });

  // Fetch LLM health status from GET /api/v1/system/llm
  const fetchLlmHealth = async () => {
    setIsHealthLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: LLMHealthStatus }>('/system/llm');
      if (res.data?.data) {
        setLlmHealth(res.data.data);
      }
    } catch {
      setLlmHealth({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        status: 'unreachable',
        latency_ms: 0,
      });
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchLlmHealth();
  }, []);

  // Populate form from backend data when loaded
  useEffect(() => {
    if (settings) {
      setLlmProvider(settings.llm_provider || 'Groq Llama-3.3 70B Versatile');
      setNeo4jUri(settings.neo4j_uri || 'bolt://localhost:7687');
      setQdrantUrl(settings.qdrant_url || 'http://localhost:6333');
      setEmbeddingModel(settings.embedding_model || 'all-MiniLM-L6-v2');
      setTheme(settings.theme || 'light');
      setSecurityAuditMode(settings.security_audit_mode ?? true);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await updateSettings({
        llm_provider: llmProvider,
        neo4j_uri: neo4jUri,
        qdrant_url: qdrantUrl,
        embedding_model: embeddingModel,
        api_key_status: settings?.api_key_status || 'Configured',
        theme,
        security_audit_mode: securityAuditMode,
      });
      showToast('System settings saved successfully!', 'success');
      fetchLlmHealth();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse mb-3" />
          <div className="h-4 w-96 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 w-fit mb-2">
            <span className="material-symbols-outlined text-sm">settings_applications</span>
            Admin Control Panel
          </div>
          <h2 className="text-xl font-bold text-slate-900">System Infrastructure & LLM Provider</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure Groq LLM Engine, Neo4j Graph DB, Qdrant Vector Store, and Embedding Models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLlmHealth}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh Health
          </button>
        </div>
      </div>

      {/* Real-time LLM Health & Provider Status Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="material-symbols-outlined text-blue-600">psychology</span>
          Active LLM Provider Status & Health Diagnostic
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Active Provider
            </span>
            <span className="text-sm font-bold text-slate-900 capitalize">
              {isHealthLoading ? 'Loading…' : llmHealth?.provider || 'Groq'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Current Model
            </span>
            <span className="text-xs font-bold text-blue-600 font-mono">
              {isHealthLoading ? 'Loading…' : llmHealth?.model || 'llama-3.3-70b-versatile'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Connection Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  llmHealth?.status === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : llmHealth?.status === 'unconfigured'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-xs font-bold uppercase text-slate-800">
                {isHealthLoading ? 'Checking…' : llmHealth?.status || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Response Latency
            </span>
            <span className="text-sm font-bold font-mono text-emerald-600">
              {isHealthLoading ? '—' : `${llmHealth?.latency_ms || 0} ms`}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core AI & Infrastructure Integration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">dns</span>
            Infrastructure & Database Endpoints
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">LLM Provider Engine</label>
              <select
                disabled={!isAdmin}
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="Groq Llama-3.3 70B Versatile">Groq Llama-3.3 70B Versatile (Default Production)</option>
                <option value="Groq Llama-3.1 8B Instant">Groq Llama-3.1 8B Instant (Fast Low-Latency)</option>
                <option value="Groq GPT-OSS 120B">Groq GPT-OSS 120B (High Precision Reasoning)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Embedding AI Model</label>
              <select
                disabled={!isAdmin}
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="all-MiniLM-L6-v2">SentenceTransformers all-MiniLM-L6-v2 (384 dim)</option>
                <option value="bge-large-en-v1.5">BAAI/bge-large-en-v1.5 (1024 dim)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Neo4j Connection URI</label>
              <input
                disabled={!isAdmin}
                type="text"
                value={neo4jUri}
                onChange={(e) => setNeo4jUri(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Qdrant Vector Database URL</label>
              <input
                disabled={!isAdmin}
                type="text"
                value={qdrantUrl}
                onChange={(e) => setQdrantUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">UI Theme Mode</label>
              <select
                disabled={!isAdmin}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="light">Enterprise Light Mode</option>
                <option value="dark">Dark Compliance Mode</option>
                <option value="system">System Auto</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Security Audit Mode</label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setSecurityAuditMode(!securityAuditMode)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                    securityAuditMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
                <span className="text-xs text-slate-600 font-medium">
                  {securityAuditMode ? 'Enabled — All actions logged' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Compliance Frameworks */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">gavel</span>
            Active Compliance Frameworks
          </h3>

          <div className="space-y-2">
            {Object.entries({
              hipaa: 'HIPAA (Health Insurance Portability & Accountability Act)',
              gdpr: 'GDPR (EU General Data Protection Regulation)',
              soc2: 'SOC2 Type II (AICPA Trust Services Criteria)',
              iso27001: 'ISO 27001 (Information Security Management)',
              fincen: 'FinCEN (Financial Crimes Enforcement Network)',
            }).map(([key, label]) => (
              <div key={key} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-800">{label}</span>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() =>
                    setFrameworks((prev) => ({ ...prev, [key]: !prev[key as keyof typeof frameworks] }))
                  }
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                    frameworks[key as keyof typeof frameworks] ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base">
                {isSaving ? 'sync' : 'save'}
              </span>
              {isSaving ? 'Saving…' : 'Save System Configuration'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
