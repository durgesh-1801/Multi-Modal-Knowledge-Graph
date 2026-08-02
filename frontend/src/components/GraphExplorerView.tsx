import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGraphOverview, useGraphStats } from '../hooks/useGraph';
import { useSendMessage } from '../hooks/useChat';
import { BackendGraphNode, BackendGraphEdge } from '../types';

// ─── Node position after layout ──────────────────────────────────────────────
interface LayoutNode extends BackendGraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  radius: number;
  degree: number;
}

// ─── Color maps ───────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  Framework:    { fill: '#3b82f6', stroke: '#60a5fa', text: '#dbeafe' },
  Policy:       { fill: '#8b5cf6', stroke: '#a78bfa', text: '#ede9fe' },
  Control:      { fill: '#06b6d4', stroke: '#22d3ee', text: '#cffafe' },
  Risk:         { fill: '#ef4444', stroke: '#f87171', text: '#fee2e2' },
  Requirement:  { fill: '#f59e0b', stroke: '#fbbf24', text: '#fef3c7' },
  Person:       { fill: '#10b981', stroke: '#34d399', text: '#d1fae5' },
  Organization: { fill: '#6366f1', stroke: '#818cf8', text: '#e0e7ff' },
  System:       { fill: '#0ea5e9', stroke: '#38bdf8', text: '#e0f2fe' },
  Document:     { fill: '#64748b', stroke: '#94a3b8', text: '#e2e8f0' },
  Department:   { fill: '#f97316', stroke: '#fb923c', text: '#ffedd5' },
  Regulation:   { fill: '#14b8a6', stroke: '#2dd4bf', text: '#ccfbf1' },
  Audit:        { fill: '#a855f7', stroke: '#c084fc', text: '#f3e8ff' },
  Entity:       { fill: '#475569', stroke: '#64748b', text: '#e2e8f0' },
};
const defaultColor = { fill: '#475569', stroke: '#64748b', text: '#e2e8f0' };
const getColor = (type: string) => TYPE_COLOR[type] || defaultColor;

const TYPE_ICON: Record<string, string> = {
  Framework: 'verified_user', Policy: 'policy', Control: 'security',
  Risk: 'warning', Requirement: 'rule', Person: 'person',
  Organization: 'domain', System: 'hub', Document: 'description',
  Department: 'corporate_fare', Regulation: 'gavel', Audit: 'fact_check',
};
const getIcon = (type: string) => TYPE_ICON[type] || 'grain';

// ─── Simple force-directed layout ────────────────────────────────────────────
function forceLayout(
  nodes: LayoutNode[],
  edges: BackendGraphEdge[],
  iterations = 120,
  width = 900,
  height = 700,
): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1));
  const idxMap = new Map<string, number>();
  nodes.forEach((n, i) => idxMap.set(n.id, i));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const temp = k * cooling * 0.5;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].vx = 0;
      nodes[i].vy = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (k * k) / dist;
        nodes[i].vx += (dx / dist) * force;
        nodes[i].vy += (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const si = idxMap.get(edge.source);
      const ti = idxMap.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[si].vx += fx;
      nodes[si].vy += fy;
      nodes[ti].vx -= fx;
      nodes[ti].vy -= fy;
    }

    // Gravity toward center
    for (const n of nodes) {
      n.vx += ((width / 2) - n.x) * 0.01;
      n.vy += ((height / 2) - n.y) * 0.01;
    }

    // Apply velocity with temp cap
    for (const n of nodes) {
      if (n.fx !== null) { n.x = n.fx; n.y = n.fy!; continue; }
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > temp) { n.vx = (n.vx / speed) * temp; n.vy = (n.vy / speed) * temp; }
      n.x = Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x + n.vx));
      n.y = Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y + n.vy));
    }
  }

  return nodes;
}

// ─── Main component ───────────────────────────────────────────────────────────
export const GraphExplorerView: React.FC = () => {
  const { data: graphData, isLoading } = useGraphOverview(500);
  const { data: graphStats } = useGraphStats();
  const { mutateAsync: sendMessage } = useSendMessage();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ nodeId: string | null; canvas: boolean }>({ nodeId: null, canvas: false });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const layoutRef = useRef<LayoutNode[]>([]);
  panRef.current = pan;
  zoomRef.current = zoom;
  layoutRef.current = layoutNodes;

  const W = 900, H = 700;

  // Build layout nodes from backend data
  useEffect(() => {
    const rawNodes = graphData?.nodes ?? [];
    const rawEdges = graphData?.edges ?? [];
    if (!rawNodes.length) { setLayoutNodes([]); return; }

    // Count degree
    const degMap = new Map<string, number>();
    for (const e of rawEdges) {
      degMap.set(e.source, (degMap.get(e.source) ?? 0) + 1);
      degMap.set(e.target, (degMap.get(e.target) ?? 0) + 1);
    }

    const nodes: LayoutNode[] = rawNodes.map((n, i) => {
      const angle = (i / rawNodes.length) * 2 * Math.PI;
      const r = Math.min(W, H) * 0.32;
      const deg = degMap.get(n.id) ?? 0;
      return {
        ...n,
        x: W / 2 + r * Math.cos(angle),
        y: H / 2 + r * Math.sin(angle),
        vx: 0, vy: 0, fx: null, fy: null,
        radius: Math.max(18, Math.min(18 + deg * 2.5, 34)),
        degree: deg,
      };
    });

    const laid = forceLayout(nodes, rawEdges);
    setLayoutNodes(laid);
  }, [graphData]);

  // Canvas renderer
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = layoutRef.current;
    const edges = graphData?.edges ?? [];
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    // Grid dots
    ctx.save();
    ctx.fillStyle = 'rgba(148,163,184,0.08)';
    const gridSpacing = 30;
    for (let gx = 0; gx < w; gx += gridSpacing) {
      for (let gy = 0; gy < h; gy += gridSpacing) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    const nodeIdxMap = new Map<string, LayoutNode>();
    nodes.forEach(n => nodeIdxMap.set(n.id, n));

    const selNode = selectedId ? nodeIdxMap.get(selectedId) : null;
    const hovNode = hoveredId ? nodeIdxMap.get(hoveredId) : null;

    const connectedIds = new Set<string>();
    const connectedEdgeIndices = new Set<number>();
    if (selNode) {
      connectedIds.add(selNode.id);
      edges.forEach((e, i) => {
        if (e.source === selNode.id || e.target === selNode.id) {
          connectedIds.add(e.source);
          connectedIds.add(e.target);
          connectedEdgeIndices.add(i);
        }
      });
    }

    const hasSelection = !!selNode;

    // Draw edges
    edges.forEach((edge, i) => {
      const src = nodeIdxMap.get(edge.source);
      const tgt = nodeIdxMap.get(edge.target);
      if (!src || !tgt) return;

      const isHighlighted = connectedEdgeIndices.has(i);
      const isDimmed = hasSelection && !isHighlighted;
      const isHoveredEdge = hovNode && (edge.source === hovNode.id || edge.target === hovNode.id);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (isDimmed) {
        ctx.strokeStyle = 'rgba(148,163,184,0.08)';
        ctx.lineWidth = 1;
      } else if (isHighlighted || isHoveredEdge) {
        ctx.strokeStyle = 'rgba(99,179,237,0.9)';
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();

      // Arrow
      if (!isDimmed) {
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const arrowDist = tgt.radius + 5;
        const ax = tgt.x - arrowDist * Math.cos(angle);
        const ay = tgt.y - arrowDist * Math.sin(angle);
        ctx.beginPath();
        ctx.fillStyle = isHighlighted || isHoveredEdge ? 'rgba(99,179,237,0.9)' : 'rgba(148,163,184,0.3)';
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle - Math.PI / 6), ay - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax - 8 * Math.cos(angle + Math.PI / 6), ay - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Edge label on highlight
        if (isHighlighted && zoom > 0.7) {
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          ctx.font = 'bold 8px Inter, sans-serif';
          ctx.fillStyle = 'rgba(148,163,184,0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(edge.type || '', mx, my - 5);
        }
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const color = getColor(node.type);
      const isSelected = node.id === selectedId;
      const isHovered = node.id === hoveredId;
      const isDimmed = hasSelection && !connectedIds.has(node.id);
      const r = node.radius;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.2 : 1;

      // Glow
      if (isSelected || isHovered) {
        ctx.shadowColor = color.stroke;
        ctx.shadowBlur = isSelected ? 20 : 12;
      }

      // Circle fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
      grad.addColorStop(0, color.stroke);
      grad.addColorStop(1, color.fill);
      ctx.fillStyle = grad;
      ctx.fill();

      // Ring for selected
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Label
      if (zoom > 0.55 || isSelected || isHovered) {
        const labelY = node.y + r + 13;
        const label = node.name || node.id;
        const maxW = 100;
        ctx.font = isSelected ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.fillStyle = isSelected ? '#f8fafc' : '#cbd5e1';
        ctx.textAlign = 'center';

        // Truncate
        let displayLabel = label;
        while (ctx.measureText(displayLabel).width > maxW && displayLabel.length > 4) {
          displayLabel = displayLabel.slice(0, -4) + '…';
        }

        ctx.fillText(displayLabel, node.x, labelY);

        // Type badge on selected/hover
        if (isSelected || (isHovered && zoom > 0.7)) {
          ctx.font = '8px Inter, sans-serif';
          ctx.fillStyle = color.stroke;
          ctx.fillText(node.type, node.x, labelY + 12);
        }
      }

      ctx.restore();
    });

    ctx.restore();
  }, [graphData, selectedId, hoveredId, zoom]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw, pan, zoom, layoutNodes]);

  // Canvas interactions
  const getWorldPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const findNodeAt = (wx: number, wy: number): LayoutNode | null => {
    for (let i = layoutNodes.length - 1; i >= 0; i--) {
      const n = layoutNodes[i];
      if (Math.hypot(n.x - wx, n.y - wy) <= n.radius + 6) return n;
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getWorldPos(e);
    const hit = findNodeAt(x, y);
    if (hit) {
      setDragging({ nodeId: hit.id, canvas: false });
    } else {
      setDragging({ nodeId: null, canvas: true });
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getWorldPos(e);

    if (dragging.nodeId) {
      setLayoutNodes(prev =>
        prev.map(n => n.id === dragging.nodeId ? { ...n, x, y, fx: x, fy: y } : n)
      );
      return;
    }
    if (dragging.canvas) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }

    const hit = findNodeAt(x, y);
    setHoveredId(hit?.id ?? null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging.nodeId) {
      const { x, y } = getWorldPos(e);
      const hit = findNodeAt(x, y);
      if (hit && dragging.nodeId === hit.id) {
        setSelectedId(prev => prev === hit.id ? null : hit.id);
        setAiResult(null);
      }
      // Release pin
      setLayoutNodes(prev =>
        prev.map(n => n.id === dragging.nodeId ? { ...n, fx: null, fy: null } : n)
      );
    }
    setDragging({ nodeId: null, canvas: false });
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.25, Math.min(3, prev - e.deltaY * 0.001)));
  };

  // Fit graph to screen
  const fitGraph = () => {
    if (!layoutNodes.length) return;
    const xs = layoutNodes.map(n => n.x);
    const ys = layoutNodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const scale = Math.min(
      cw / (maxX - minX + 120),
      ch / (maxY - minY + 120),
      2.5,
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(scale);
    setPan({ x: cw / 2 - cx * scale, y: ch / 2 - cy * scale });
  };

  // AI Analysis
  const selectedNode = selectedId ? layoutNodes.find(n => n.id === selectedId) : null;

  const runAiAnalysis = async () => {
    if (!selectedNode) return;
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const res = await sendMessage({
        query: `Perform compliance analysis for entity "${selectedNode.name}" (type: ${selectedNode.type}). Assess compliance posture, risk factors, and provide actionable recommendations.`,
        top_k: 5,
      });
      setAiResult(res.answer || 'No analysis returned from the AI engine.');
    } catch {
      setAiResult('Analysis error: Could not connect to the compliance engine. Please ensure the backend is running.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Search filter
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return layoutNodes.filter(n =>
      n.name?.toLowerCase().includes(q) || n.type?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, layoutNodes]);

  // Connected edges for selected node
  const selectedEdges = useMemo(() => {
    if (!selectedId) return [];
    return (graphData?.edges ?? []).filter(e => e.source === selectedId || e.target === selectedId);
  }, [selectedId, graphData]);

  const nodeCount = graphStats?.node_count ?? graphData?.nodes?.length ?? 0;
  const edgeCount = graphStats?.relationship_count ?? graphData?.edges?.length ?? 0;
  const isEmpty = !isLoading && nodeCount === 0;

  return (
    <div className="h-[calc(100vh-64px)] -m-8 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">

      {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-slate-800/90 border-b border-slate-700/60 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <span className="material-symbols-outlined text-lg">hub</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-tight">Knowledge Graph Explorer</h1>
            <p className="text-[10px] text-slate-400">Neo4j • Force-Directed Layout • Graph RAG</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {[
            { label: 'Nodes', value: nodeCount, color: 'text-blue-400' },
            { label: 'Relationships', value: edgeCount, color: 'text-purple-400' },
            { label: 'Avg Degree', value: graphStats?.average_degree?.toFixed(1) ?? '0', color: 'text-emerald-400' },
            { label: 'Density', value: graphStats?.graph_density?.toFixed(4) ?? '0', color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400 font-sans text-[10px]">{s.label}:</span>
              <span className={`font-bold text-xs ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="w-48 bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchResults.length > 0 && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {searchResults.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    setSelectedId(n.id);
                    setSearch('');
                    // Pan to node
                    const canvas = canvasRef.current;
                    if (canvas) {
                      setPan({ x: canvas.clientWidth / 2 - n.x * zoom, y: canvas.clientHeight / 2 - n.y * zoom });
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: getColor(n.type).fill }}>
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>{getIcon(n.type)}</span>
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-100 truncate">{n.name}</div>
                    <div className="text-[10px] text-slate-400">{n.type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Canvas ── */}
        <div className="flex-1 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-30">
              <div className="w-12 h-12 rounded-full border-3 border-blue-500/30 border-t-blue-500 animate-spin mb-4" />
              <p className="text-slate-400 text-sm">Loading Knowledge Graph…</p>
            </div>
          )}

          {isEmpty && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-slate-500">hub</span>
              </div>
              <h3 className="text-slate-400 font-bold mb-2">No Graph Data Available</h3>
              <p className="text-slate-500 text-xs text-center max-w-xs">
                Neo4j is unavailable or the graph is empty. Upload documents to populate the knowledge graph.
              </p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { setHoveredId(null); setDragging({ nodeId: null, canvas: false }); }}
            onWheel={onWheel}
          />

          {/* Zoom controls */}
          <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 z-20">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-1 flex flex-col gap-0.5 shadow-xl">
              {[
                { icon: 'add', action: () => setZoom(p => Math.min(p + 0.2, 3)), title: 'Zoom In' },
                { icon: 'remove', action: () => setZoom(p => Math.max(p - 0.2, 0.25)), title: 'Zoom Out' },
                { icon: 'fit_screen', action: fitGraph, title: 'Fit to Screen' },
                { icon: 'refresh', action: () => { setPan({ x: 0, y: 0 }); setZoom(1); }, title: 'Reset View' },
              ].map(btn => (
                <button
                  key={btn.icon}
                  onClick={btn.action}
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">{btn.icon}</span>
                </button>
              ))}
            </div>
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 text-center font-mono text-[10px] text-slate-400 shadow-xl">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Legend */}
          {!isEmpty && (
            <div className="absolute top-3 left-3 bg-slate-800/90 border border-slate-700 rounded-xl p-3 z-20 shadow-xl max-w-[140px]">
              <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-2">Legend</p>
              {Object.entries(TYPE_COLOR).slice(0, 6).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.fill }} />
                  <span className="text-[9px] text-slate-400">{type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <aside className="w-72 bg-slate-800/95 border-l border-slate-700/60 flex flex-col overflow-y-auto shrink-0">

          {/* Node Header */}
          <div className="p-4 border-b border-slate-700/60 bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: selectedNode ? getColor(selectedNode.type).fill + '33' : '#1e293b', border: `1px solid ${selectedNode ? getColor(selectedNode.type).stroke + '66' : '#334155'}` }}
              >
                <span className="material-symbols-outlined text-xl" style={{ color: selectedNode ? getColor(selectedNode.type).stroke : '#64748b' }}>
                  {selectedNode ? getIcon(selectedNode.type) : 'touch_app'}
                </span>
              </div>
              {selectedNode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                  ID: {selectedNode.id.slice(0, 14)}{selectedNode.id.length > 14 ? '…' : ''}
                </span>
              )}
            </div>

            <h2 className="font-bold text-sm text-slate-100 leading-tight truncate mb-1">
              {selectedNode ? selectedNode.name : 'No Node Selected'}
            </h2>
            {selectedNode && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: getColor(selectedNode.type).fill + '33', color: getColor(selectedNode.type).stroke }}
              >
                {selectedNode.type}
              </span>
            )}
            {!selectedNode && (
              <p className="text-[11px] text-slate-500 mt-1">Click any node on the graph to inspect it</p>
            )}
          </div>

          {selectedNode && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">

              {/* Properties */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">list</span> Properties
                </h3>
                <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/40">
                  {[
                    ['Degree', selectedNode.degree],
                    ['Confidence', selectedNode.properties?.confidence !== undefined ? `${Math.round(Number(selectedNode.properties.confidence) * 100)}%` : 'N/A'],
                    ['Owner', selectedNode.properties?.owner || 'N/A'],
                    ['Risk Level', selectedNode.properties?.risk_level || selectedNode.properties?.sensitivity || 'N/A'],
                    ['Data Locality', selectedNode.properties?.data_locality || 'N/A'],
                    ['Created', selectedNode.properties?.created_at ? String(selectedNode.properties.created_at).slice(0, 10) : 'N/A'],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between items-center px-3 py-2 text-[11px]">
                      <span className="text-slate-400">{k}</span>
                      <span className="font-medium text-slate-200 text-right max-w-[130px] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Relationships */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">hub</span>
                  Relationships ({selectedEdges.length})
                </h3>
                {selectedEdges.length === 0 ? (
                  <p className="text-[11px] text-slate-500 px-1">No relationships found</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedEdges.map((e, i) => {
                      const isOutgoing = e.source === selectedId;
                      const otherId = isOutgoing ? e.target : e.source;
                      const otherNode = layoutNodes.find(n => n.id === otherId);
                      return (
                        <button
                          key={i}
                          onClick={() => { setSelectedId(otherId); setAiResult(null); }}
                          className="w-full flex items-center gap-2.5 p-2.5 bg-slate-900/50 rounded-xl border border-slate-700/40 hover:border-slate-600 hover:bg-slate-700/30 transition-all text-left"
                        >
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: otherNode ? getColor(otherNode.type).fill + '33' : '#1e293b', border: `1px solid ${otherNode ? getColor(otherNode.type).stroke + '66' : '#334155'}` }}>
                            <span className="material-symbols-outlined text-xs"
                              style={{ color: otherNode ? getColor(otherNode.type).stroke : '#64748b', fontSize: 11 }}>
                              {otherNode ? getIcon(otherNode.type) : 'circle'}
                            </span>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              {isOutgoing ? (
                                <><span className="text-emerald-400">→</span> {e.type}</>
                              ) : (
                                <><span className="text-blue-400">←</span> {e.type}</>
                              )}
                            </div>
                            <div className="text-[11px] font-medium text-slate-200 truncate">
                              {otherNode?.name || otherId}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Source Documents */}
              {Array.isArray(selectedNode.properties?.source_documents) && (selectedNode.properties!.source_documents as string[]).length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">description</span> Source Documents
                  </h3>
                  <div className="space-y-1.5">
                    {(selectedNode.properties!.source_documents as string[]).map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-xl border border-slate-700/40 text-[11px]">
                        <span className="material-symbols-outlined text-red-400 text-base">picture_as_pdf</span>
                        <span className="text-slate-300 truncate font-medium">{doc}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* AI Result */}
              {aiResult && (
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-3 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold mb-2">
                    <span className="material-symbols-outlined text-sm fill">auto_awesome</span>
                    AI Compliance Analysis
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{aiResult}</p>
                </div>
              )}
            </div>
          )}

          {/* AI Analysis Button */}
          <div className="p-4 border-t border-slate-700/60 shrink-0">
            <button
              onClick={runAiAnalysis}
              disabled={aiAnalyzing || !selectedNode}
              className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: selectedNode ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : undefined,
                backgroundColor: selectedNode ? undefined : '#1e293b',
                color: selectedNode ? '#fff' : '#64748b',
              }}
            >
              <span className={`material-symbols-outlined text-base fill ${aiAnalyzing ? 'animate-spin' : ''}`}>
                {aiAnalyzing ? 'sync' : 'psychology'}
              </span>
              {aiAnalyzing ? 'Analyzing with Graph RAG…' : selectedNode ? 'AI Analysis' : 'Select a node first'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
