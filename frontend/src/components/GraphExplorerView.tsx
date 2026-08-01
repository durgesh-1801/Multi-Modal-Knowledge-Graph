import React, { useState, useMemo } from 'react';
import { GraphNode } from '../types';
import { useGraphOverview } from '../hooks/useGraph';
import { useSendMessage } from '../hooks/useChat';

export const GraphExplorerView: React.FC = () => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // ── Real API data ───────────────────────────────────────────────────────────
  const { data: graphData, isLoading: graphLoading } = useGraphOverview(100);
  const { mutateAsync: sendMessage } = useSendMessage();

  // ── Map backend nodes to frontend GraphNode format ────────────────────────
  const NODE_TYPES = ['Department', 'Policy', 'Regulation', 'Risk', 'Audit', 'Person', 'Data'] as const;
  const CANVAS_W = 900;
  const CANVAS_H = 700;

  const initialNodes: GraphNode[] = useMemo(() => {
    if (!graphData?.nodes?.length) {
      // Fallback demo nodes if backend has no data yet
      return [
        {
          id: 'node-finance', label: 'Finance Ops', type: 'Department', x: 340, y: 260,
          properties: { owner: 'Finance Dept.', lastReviewed: 'Nov 04, 2023', sensitivity: 'High', dataLocality: 'US-East-1' },
          relationships: [{ type: 'IMPLEMENTS', targetId: 'node-aml', targetLabel: 'AML Compliance' }],
          sourceDocs: [{ name: 'finance_policy_2024.pdf', size: '2.8 MB', updated: '1d ago' }],
        },
        {
          id: 'node-aml', label: 'AML Compliance', type: 'Policy', x: 650, y: 380, status: 'Compliant', version: 'v2.4.0',
          properties: { owner: 'Compliance Dept.', lastReviewed: 'Oct 12, 2023', sensitivity: 'High', dataLocality: 'Global' },
          relationships: [{ type: 'GOVERNED BY', targetId: 'node-gdpr', targetLabel: 'GDPR Art. 12' }],
          sourceDocs: [{ name: 'compliance_v2_final.pdf', size: '4.2 MB', updated: '3d ago' }],
        },
        {
          id: 'node-gdpr', label: 'GDPR Art. 12', type: 'Regulation', x: 400, y: 100,
          properties: { owner: 'Legal Affairs', lastReviewed: 'Jan 15, 2024', sensitivity: 'Critical', dataLocality: 'EU-West-1' },
          relationships: [{ type: 'GOVERNS', targetId: 'node-aml', targetLabel: 'AML Compliance' }],
          sourceDocs: [{ name: 'eu_gdpr_article12_guideline.pdf', size: '1.4 MB', updated: '5d ago' }],
        },
        {
          id: 'node-breach', label: 'Data Breach', type: 'Risk', x: 450, y: 580, status: 'Breach',
          properties: { owner: 'InfoSec Audit', lastReviewed: 'Yesterday', sensitivity: 'Critical', dataLocality: 'Shared_Drive_A' },
          relationships: [{ type: 'AUDITED BY', targetId: 'node-audit', targetLabel: 'Q3 Review' }],
          sourceDocs: [{ name: 'data_leak_investigation.pdf', size: '5.1 MB', updated: '4h ago' }],
        },
        {
          id: 'node-audit', label: 'Q3 Review', type: 'Audit', x: 720, y: 630,
          properties: { owner: 'Internal Audit', lastReviewed: 'Sep 30, 2023', sensitivity: 'Medium', dataLocality: 'US-Central' },
          relationships: [{ type: 'MONITORS', targetId: 'node-breach', targetLabel: 'Data Breach' }],
          sourceDocs: [{ name: 'q3_internal_audit_summary.docx', size: '890 KB', updated: '1w ago' }],
        },
      ];
    }

    // Map backend nodes to GraphNode format with auto-layout
    return graphData.nodes.map((backendNode, idx) => {
      const angle = (idx / graphData.nodes.length) * 2 * Math.PI;
      const radius = Math.min(CANVAS_W, CANVAS_H) * 0.3;
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const x = Math.round(cx + radius * Math.cos(angle)) - 60;
      const y = Math.round(cy + radius * Math.sin(angle)) - 30;

      const nodeType = backendNode.type as GraphNode['type'] || 'Policy';
      const validType = NODE_TYPES.includes(nodeType as typeof NODE_TYPES[number]) ? nodeType : 'Policy';

      // Build relationships from edges
      const outEdges = (graphData.edges || []).filter((e) => e.source === backendNode.id);
      const relationships = outEdges.map((e) => ({
        type: e.type,
        targetId: e.target,
        targetLabel: graphData.nodes.find((n) => n.id === e.target)?.name || e.target,
      }));

      return {
        id: backendNode.id,
        label: backendNode.name || backendNode.id,
        type: validType as GraphNode['type'],
        x,
        y,
        properties: {
          owner: String(backendNode.properties?.owner || 'Unknown'),
          lastReviewed: String(backendNode.properties?.last_reviewed || 'N/A'),
          sensitivity: (backendNode.properties?.sensitivity as 'Low' | 'Medium' | 'High' | 'Critical') || 'Medium',
          dataLocality: String(backendNode.properties?.data_locality || 'Global'),
        },
        relationships,
        sourceDocs: [],
      } as GraphNode;
    });
  }, [graphData]);


  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const activeNode = selectedNode || initialNodes[0] || {
    id: 'node-fallback',
    label: 'No Node Selected',
    type: 'Policy',
    x: 0,
    y: 0,
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    setAiResult(null);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.8));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const runAiAnalysisOnNode = async () => {
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      // Call real backend POST /api/v1/chat
      const data = await sendMessage({
        query: `Perform node-level compliance audit for ${activeNode.label} (${activeNode.type}). Sensitivity: ${activeNode.properties?.sensitivity}. Status: ${activeNode.status || 'Active'}.`,
        top_k: 3,
      });
      setAiResult(data.answer || 'No analysis result returned.');
    } catch (err) {
      setAiResult('Analysis error: Could not connect to compliance engine. Please check backend is running.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const getNodeIcon = (type: GraphNode['type']) => {
    switch (type) {
      case 'Department':
        return 'corporate_fare';
      case 'Policy':
        return 'policy';
      case 'Regulation':
        return 'gavel';
      case 'Risk':
        return 'warning';
      case 'Audit':
        return 'fact_check';
      default:
        return 'hub';
    }
  };

  const getNodeColorClass = (type: GraphNode['type']) => {
    switch (type) {
      case 'Department':
        return {
          border: 'border-primary/50 shadow-primary/10',
          bg: 'bg-primary/20',
          text: 'text-primary',
          dot: 'bg-primary',
        };
      case 'Policy':
        return {
          border: 'border-tertiary/50 shadow-tertiary/10',
          bg: 'bg-tertiary/20',
          text: 'text-tertiary',
          dot: 'bg-tertiary',
        };
      case 'Regulation':
        return {
          border: 'border-secondary/50 shadow-secondary/10',
          bg: 'bg-secondary/20',
          text: 'text-secondary',
          dot: 'bg-secondary',
        };
      case 'Risk':
        return {
          border: 'border-error/50 shadow-error/10',
          bg: 'bg-error/20',
          text: 'text-error',
          dot: 'bg-error',
        };
      case 'Audit':
        return {
          border: 'border-primary-container/50 shadow-primary-container/10',
          bg: 'bg-primary-container/20',
          text: 'text-primary-container',
          dot: 'bg-primary-container',
        };
      default:
        return {
          border: 'border-outline/50 shadow-outline/10',
          bg: 'bg-outline/20',
          text: 'text-on-surface',
          dot: 'bg-primary',
        };
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] -m-8 flex relative overflow-hidden select-none animate-in fade-in duration-300">
      {/* Canvas Area */}
      <div className="flex-1 canvas-grid relative overflow-hidden bg-background" id="graph-canvas">
        {/* Transform container for zoom */}
        <div
          className="w-full h-full relative transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          {/* SVG Graph Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(173, 198, 255, 0.5)" />
              </marker>
            </defs>

            {/* Edge lines connecting nodes */}
            <path d="M 400 100 Q 550 240 650 380" fill="none" stroke="rgba(208, 188, 255, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" className="edge-flow" />
            <path d="M 340 260 Q 500 320 650 380" fill="none" stroke="rgba(173, 198, 255, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" className="edge-flow" />
            <path d="M 340 260 Q 380 420 450 580" fill="none" stroke="rgba(255, 180, 171, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" className="edge-flow" />
            <path d="M 450 580 Q 600 600 720 630" fill="none" stroke="rgba(78, 222, 163, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" className="edge-flow" />
          </svg>

          {/* Render Nodes */}
          {initialNodes.map((node) => {
            const style = getNodeColorClass(node.type);
            const isSelected = activeNode.id === node.id;

            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className="absolute z-20 cursor-pointer"
                style={{ top: `${node.y}px`, left: `${node.x}px` }}
              >
                <div
                  className={`glass-panel px-4 py-3 rounded-2xl flex items-center gap-3 ${style.border} shadow-xl hover:scale-105 transition-all ${
                    isSelected ? 'ring-2 ring-primary bg-surface-container-highest/80' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center ${style.text}`}>
                    <span className="material-symbols-outlined">{getNodeIcon(node.type)}</span>
                  </div>
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-widest leading-none mb-1 opacity-75 ${style.text}`}>
                      {node.type}
                    </div>
                    <div className="font-bold text-sm text-on-surface">{node.label}</div>
                  </div>
                  {node.status && (
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot} node-pulse ml-2`}></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Graph Toolbar */}
        <div className="absolute bottom-8 left-8 flex flex-col gap-2 z-20">
          <div className="glass-panel rounded-xl p-1 flex flex-col gap-1 shadow-lg border border-outline-variant/30">
            <button
              onClick={handleZoomIn}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer text-on-surface"
              title="Zoom In"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <button
              onClick={handleZoomOut}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer text-on-surface"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>

          <div className="glass-panel rounded-xl p-1 flex flex-col gap-1 shadow-lg border border-outline-variant/30">
            <button
              onClick={handleResetZoom}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer text-on-surface"
              title="Fit to Screen"
            >
              <span className="material-symbols-outlined">fit_screen</span>
            </button>
            <button
              onClick={() => setPanMode(!panMode)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                panMode ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-highest text-on-surface'
              }`}
              title="Toggle Pan Tool"
            >
              <span className="material-symbols-outlined">pan_tool</span>
            </button>
          </div>
        </div>

        {/* Mini Map */}
        <div className="absolute bottom-8 right-8 w-48 h-32 glass-panel rounded-xl overflow-hidden z-20 border border-primary/20 shadow-xl hidden sm:block">
          <div className="w-full h-full bg-surface-container-low opacity-60 relative p-2">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-7 border border-primary rounded-sm bg-primary/20"></div>
            {/* Tiny dots */}
            <div className="w-1.5 h-1.5 rounded-full bg-primary absolute top-4 left-8"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-secondary absolute top-8 left-20"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-tertiary absolute bottom-6 right-12"></div>
          </div>
          <div className="absolute bottom-2 left-2 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant/80">
            Minimap
          </div>
        </div>
      </div>

      {/* Entity Details Inspector Panel (Right Sidebar) */}
      <aside className="w-[340px] h-full bg-surface-container-low border-l border-outline-variant/30 flex flex-col z-30 overflow-y-auto">
        <div className="p-6 border-b border-outline-variant/20 bg-surface-container/50">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary border border-tertiary/20">
              <span className="material-symbols-outlined text-2xl">{getNodeIcon(activeNode.type)}</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface-container-highest text-outline">
              ID: {activeNode.id}
            </span>
          </div>

          <h2 className="font-headline-md text-xl font-bold text-on-surface mb-2">{activeNode.label}</h2>

          <div className="flex gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-[10px] font-bold border border-tertiary/20">
              {activeNode.status || 'Active'}
            </span>
            {activeNode.version && (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant text-[10px] font-bold border border-outline-variant/20 font-mono">
                {activeNode.version}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Properties */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">list</span> Properties
            </h3>
            <div className="space-y-2.5 bg-surface-container-lowest/60 p-3.5 rounded-xl border border-outline-variant/20">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Owner</span>
                <span className="font-medium text-on-surface">{activeNode.properties?.owner || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Last Reviewed</span>
                <span className="font-medium text-on-surface">{activeNode.properties?.lastReviewed || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Sensitivity</span>
                <span
                  className={`font-bold ${
                    activeNode.properties?.sensitivity === 'Critical' || activeNode.properties?.sensitivity === 'High'
                      ? 'text-error'
                      : 'text-tertiary'
                  }`}
                >
                  {activeNode.properties?.sensitivity || 'Normal'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Data Locality</span>
                <span className="font-medium text-on-surface">{activeNode.properties?.dataLocality || 'Global'}</span>
              </div>
            </div>
          </section>

          {/* Relationships */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">hub</span> Relationships ({activeNode.relationships?.length || 0})
            </h3>
            <div className="space-y-2">
              {activeNode.relationships?.map((rel, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const target = initialNodes.find((n) => n.id === rel.targetId);
                    if (target) setSelectedNode(target);
                  }}
                  className="p-3 glass-panel rounded-xl flex items-center gap-3 cursor-pointer hover:bg-surface-container-highest transition-colors border border-outline-variant/20"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-sm">
                    <span className="material-symbols-outlined text-base">corporate_fare</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-[9px] text-on-surface-variant font-mono font-bold uppercase tracking-wider">
                      {rel.type}
                    </div>
                    <div className="text-xs font-bold text-on-surface truncate">{rel.targetLabel}</div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-outline">chevron_right</span>
                </div>
              ))}
            </div>
          </section>

          {/* Source Documents */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">description</span> Source Documents
            </h3>
            {activeNode.sourceDocs?.map((doc, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest flex items-start gap-3"
              >
                <span className="material-symbols-outlined text-primary text-xl">picture_as_pdf</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-on-surface truncate">{doc.name}</div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5 font-mono">
                    PDF • {doc.size} • Updated {doc.updated}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button className="px-3 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                      View
                    </button>
                    <button className="px-3 py-1 bg-surface-container-highest text-on-surface text-[10px] font-bold rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* AI Analysis Result */}
          {aiResult && (
            <div className="p-4 bg-primary-container/10 border border-primary/30 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-primary text-xs font-bold">
                <span className="material-symbols-outlined fill text-sm">auto_awesome</span>
                AI Compliance Analysis
              </div>
              <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line">{aiResult}</p>
            </div>
          )}
        </div>

        {/* AI Analysis Trigger Footer */}
        <div className="p-6 border-t border-outline-variant/20 bg-surface-container/50">
          <button
            onClick={runAiAnalysisOnNode}
            disabled={aiAnalyzing}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg fill">
              {aiAnalyzing ? 'sync' : 'psychology'}
            </span>
            {aiAnalyzing ? 'Analyzing Node with Groq AI…' : 'AI Analysis'}
          </button>
        </div>
      </aside>

      {/* Floating AI Insights FAB */}
      <div className="fixed bottom-8 right-[360px] z-40 group">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface text-[10px] px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-outline-variant/30 pointer-events-none shadow-xl">
          3 AI Insights Available
        </div>
        <button
          onClick={runAiAnalysisOnNode}
          className="w-13 h-13 rounded-full bg-secondary text-on-secondary shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-2xl fill">bolt</span>
        </button>
      </div>
    </div>
  );
};
