import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'ADMIN';

  const [llmProvider, setLlmProvider] = useState('Google Gemini Pro');
  const [neo4jUri, setNeo4jUri] = useState('bolt://localhost:7687');
  const [qdrantUrl, setQdrantUrl] = useState('http://localhost:6333');
  const [embeddingModel, setEmbeddingModel] = useState('all-MiniLM-L6-v2');
  const [apiKey, setApiKey] = useState('••••••••••••••••••••••••');
  const [theme, setTheme] = useState('light');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [frameworks, setFrameworks] = useState({
    hipaa: true,
    gdpr: true,
    soc2: true,
    iso27001: true,
    fincen: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 w-fit mb-2">
            <span className="material-symbols-outlined text-sm">settings_applications</span>
            Admin Control Panel
          </div>
          <h2 className="text-xl font-bold text-slate-900">System Infrastructure & AI Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure LLM models, Neo4j Graph DB, Qdrant Vector Store, Embedding Engines, and API keys.
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Settings Saved
          </span>
        )}
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white"
              >
                <option value="Google Gemini Pro">Google Gemini Pro (Gemini-2.5-Flash)</option>
                <option value="Google Gemini Ultra">Google Gemini Ultra</option>
                <option value="Local Llama3 Compliance">Local Llama-3 70B (Ollama)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Embedding AI Model</label>
              <select
                disabled={!isAdmin}
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white"
              >
                <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (384 dim)</option>
                <option value="text-embedding-004">Google text-embedding-004 (768 dim)</option>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Gemini API Key</label>
              <input
                disabled={!isAdmin}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">UI Theme Mode</label>
              <select
                disabled={!isAdmin}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white"
              >
                <option value="light">Enterprise Light Mode</option>
                <option value="dark">Dark Compliance Mode</option>
                <option value="system">System Auto</option>
              </select>
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
                    setFrameworks((prev: any) => ({ ...prev, [key]: !prev[key as keyof typeof frameworks] }))
                  }
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                    frameworks[key as keyof typeof frameworks] ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">save</span>
              Save System Configuration
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
