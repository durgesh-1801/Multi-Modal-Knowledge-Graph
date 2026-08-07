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
  displayName: string;
}

// ─── Standard Compliance Name Mappings ───────────────────────────────────────
const STANDARD_NAMES: Record<string, string> = {
  '800-53': 'NIST SP 800-53',
  '800-37': 'NIST SP 800-37 (RMF)',
  '800-30': 'NIST SP 800-30 (Risk)',
  '800-171': 'NIST CMMC 800-171',
  '800-53r5': 'NIST SP 800-53 Rev 5',
  '800-37r2': 'NIST SP 800-37 Rev 2',
  '27001': 'ISO/IEC 27001',
  '800': 'NIST SP 800-53',
  '13': 'Access Control',
  '59': 'Multi-Factor Authentication',
  '16': 'Encryption Policy',
  '11': 'Risk Management Framework',
};

// ─── Requirement 1: Label Resolution Priority ────────────────────────────────
function getNodeLabel(node: BackendGraphNode): string {
  const p = node.properties || {};
  const rawName = (node.name || '').trim();

  // 1. Check dictionary map
  if (STANDARD_NAMES[rawName]) return STANDARD_NAMES[rawName];
  if (node.id && STANDARD_NAMES[node.id.trim()]) return STANDARD_NAMES[node.id.trim()];

  // 2. Priority fields: name → title → display_name → framework_name → control_name → policy_name → risk_name → requirement_name → document_name → id
  const candidates = [
    node.name,
    p.title,
    p.name,
    p.display_name,
    p.framework_name,
    p.control_name,
    p.policy_name,
    p.risk_name,
    p.requirement_name,
    p.document_name,
    p.label,
  ];

  for (const cand of candidates) {
    if (cand !== undefined && cand !== null) {
      const str = String(cand).trim();
      // Never display extraction metadata ("Extracted via...") or raw numbers
      if (
        str &&
        !str.toLowerCase().startsWith('extracted via') &&
        !str.toLowerCase().startsWith('spacy') &&
        !/^\d+$/.test(str)
      ) {
        return str;
      }
    }
  }

  // 3. Format numeric reference codes cleanly (e.g. 800-30 → NIST SP 800-30)
  if (rawName && /^\d+(-\d+)?[a-z0-9]*$/i.test(rawName)) {
    if (rawName.startsWith('800-')) return `NIST SP ${rawName.toUpperCase()}`;
    return `Ref ${rawName}`;
  }

  // 4. Fallback to node.name if non-metadata, else ID
  if (rawName && !rawName.toLowerCase().startsWith('extracted via')) {
    return rawName;
  }

  return node.id ? `Entity (${node.id.slice(0, 8)})` : 'Compliance Entity';
}

// ─── Requirement 2: Node Colors by Entity Type ────────────────────────────────
const TYPE_COLOR: Record<string, { fill: string; stroke: string; text: string; bg: string }> = {
  Framework:    { fill: '#3B82F6', stroke: '#60A5FA', text: '#DBEAFE', bg: 'rgba(59, 130, 246, 0.25)' },
  Policy:       { fill: '#8B5CF6', stroke: '#A78BFA', text: '#EDE9FE', bg: 'rgba(139, 92, 246, 0.25)' },
  Control:      { fill: '#06B6D4', stroke: '#22D3EE', text: '#CFFAFE', bg: 'rgba(6, 182, 212, 0.25)' },
  Risk:         { fill: '#EF4444', stroke: '#F87171', text: '#FEE2E2', bg: 'rgba(239, 68, 68, 0.25)' },
  Requirement:  { fill: '#F59E0B', stroke: '#FBBF24', text: '#FEF3C7', bg: 'rgba(245, 158, 11, 0.25)' },
  Person:       { fill: '#10B981', stroke: '#34D399', text: '#D1FAE5', bg: 'rgba(16, 185, 129, 0.25)' },
  Organization: { fill: '#FACC15', stroke: '#FDE047', text: '#FEF9C3', bg: 'rgba(250, 204, 21, 0.25)' },
  Document:     { fill: '#E5E7EB', stroke: '#9CA3AF', text: '#FFFFFF', bg: 'rgba(229, 231, 235, 0.25)' },
  System:       { fill: '#0EA5E9', stroke: '#38BDF8', text: '#E0F2FE', bg: 'rgba(14, 165, 233, 0.25)' },
  Department:   { fill: '#F97316', stroke: '#FB923C', text: '#FFEDD5', bg: 'rgba(249, 115, 22, 0.25)' },
  Regulation:   { fill: '#14B8A6', stroke: '#2DD4BF', text: '#CCFBF1', bg: 'rgba(20, 184, 166, 0.25)' },
  Audit:        { fill: '#A855F7', stroke: '#C084FC', text: '#F3E8FF', bg: 'rgba(168, 85, 247, 0.25)' },
  Unknown:      { fill: '#6B7280', stroke: '#9CA3AF', text: '#E5E7EB', bg: 'rgba(107, 114, 128, 0.25)' },
};

const defaultColor = { fill: '#6B7280', stroke: '#9CA3AF', text: '#E5E7EB', bg: 'rgba(107, 114, 128, 0.25)' };
const getColor = (type: string) => TYPE_COLOR[type] || defaultColor;

const TYPE_ICON: Record<string, string> = {
  Framework: 'verified_user', Policy: 'policy', Control: 'security',
  Risk: 'warning', Requirement: 'rule', Person: 'person',
  Organization: 'domain', System: 'hub', Document: 'description',
  Department: 'corporate_fare', Regulation: 'gavel', Audit: 'fact_check',
  Unknown: 'help_outline',
};
const getIcon = (type: string) => TYPE_ICON[type] || 'grain';

// ─── Requirement 4 & 5: Tuned Force-Directed Layout ────────────────────────
function forceLayout(
  nodes: LayoutNode[],
  edges: BackendGraphEdge[],
  iterations = 90,
  width = 1200,
  height = 800,
): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 1.35;
  const idxMap = new Map<string, number>();
  nodes.forEach((n, i) => idxMap.set(n.id, i));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const temp = k * cooling * 0.45;

    // 1. Repulsion (Charge Repulsion)
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

    // 2. Attraction along Edges (Link Distance)
    for (const edge of edges) {
      const si = idxMap.get(edge.source);
      const ti = idxMap.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist * dist) / (k * 1.1);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[si].vx += fx;
      nodes[si].vy += fy;
      nodes[ti].vx -= fx;
      nodes[ti].vy -= fy;
    }

    // 3. Collision Detection (Prevent Overlap)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const minDist = nodes[i].radius + nodes[j].radius + 28;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          if (nodes[i].fx === null) { nodes[i].x -= nx * overlap; nodes[i].y -= ny * overlap; }
          if (nodes[j].fx === null) { nodes[j].x += nx * overlap; nodes[j].y += ny * overlap; }
        }
      }
    }

    // 4. Center Gravity
    for (const n of nodes) {
      n.vx += ((width / 2) - n.x) * 0.005;
      n.vy += ((height / 2) - n.y) * 0.005;
    }

    // 5. Apply Velocities with Temp Cap
    for (const n of nodes) {
      if (n.fx !== null) { n.x = n.fx; n.y = n.fy!; continue; }
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > temp) { n.vx = (n.vx / speed) * temp; n.vy = (n.vy / speed) * temp; }
      n.x = Math.max(n.radius + 30, Math.min(width - n.radius - 30, n.x + n.vx));
      n.y = Math.max(n.radius + 30, Math.min(height - n.radius - 30, n.y + n.vy));
    }
  }

  return nodes;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const GraphExplorerView: React.FC = () => {
  const { data: graphData, isLoading } = useGraphOverview(200);
  const { data: graphStats } = useGraphStats();
  const { mutateAsync: sendMessage } = useSendMessage();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ nodeId: string | null; canvas: boolean }>({ nodeId: null, canvas: false });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);

  // Filtering Controls
  const [nodeLimit, setNodeLimit] = useState<number>(100);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [hideIsolated, setHideIsolated] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const layoutRef = useRef<LayoutNode[]>([]);
  panRef.current = pan;
  zoomRef.current = zoom;
  layoutRef.current = layoutNodes;

  const W = 1200, H = 800;

  // Filter & rank nodes for optimal graph view
  const displayNodes = useMemo(() => {
    const rawNodes = graphData?.nodes ?? [];
    const rawEdges = graphData?.edges ?? [];
    if (!rawNodes.length) return [];

    const degMap = new Map<string, number>();
    for (const e of rawEdges) {
      degMap.set(e.source, (degMap.get(e.source) ?? 0) + 1);
      degMap.set(e.target, (degMap.get(e.target) ?? 0) + 1);
    }

    let candidates = rawNodes;
    if (selectedType !== 'ALL') {
      candidates = candidates.filter(n => n.type === selectedType);
    }
    if (hideIsolated) {
      candidates = candidates.filter(n => (degMap.get(n.id) ?? 0) > 0);
    }

    // Sort by connection degree (most connected first)
    candidates.sort((a, b) => (degMap.get(b.id) ?? 0) - (degMap.get(a.id) ?? 0));
    return candidates.slice(0, nodeLimit);
  }, [graphData, selectedType, hideIsolated, nodeLimit]);

  // Requirement 6: Node Sizing based on degree
  useEffect(() => {
    const rawEdges = graphData?.edges ?? [];
    if (!displayNodes.length) { setLayoutNodes([]); return; }

    const degMap = new Map<string, number>();
    for (const e of rawEdges) {
      degMap.set(e.source, (degMap.get(e.source) ?? 0) + 1);
      degMap.set(e.target, (degMap.get(e.target) ?? 0) + 1);
    }

    const nodes: LayoutNode[] = displayNodes.map((n, i) => {
      const deg = degMap.get(n.id) ?? 0;
      
      // Phyllotaxis spiral initial distribution
      const phi = i * 137.5 * (Math.PI / 180);
      const r = 26 * Math.sqrt(i + 1);
      const initialX = W / 2 + r * Math.cos(phi);
      const initialY = H / 2 + r * Math.sin(phi);

      // Degree-dependent sizing (Large for hub nodes, Small for leaf nodes)
      let radius = 16;
      if (deg <= 1) radius = 14;
      else if (deg <= 4) radius = 22;
      else radius = Math.min(28 + deg * 2, 42);

      // Do not make unrelated document nodes excessively large
      if (n.type === 'Document' && deg <= 2) {
        radius = 16;
      }

      return {
        ...n,
        x: initialX,
        y: initialY,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        radius,
        degree: deg,
        displayName: getNodeLabel(n),
      };
    });

    const laid = forceLayout(nodes, rawEdges, 70, W, H);
    setLayoutNodes(laid);
  }, [displayNodes, graphData]);

  // Requirement 9: Graph Initialization - Auto-fit viewport
  const fitGraph = useCallback(() => {
    const nodes = layoutRef.current;
    if (!nodes.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const graphWidth = maxX - minX + 180;
    const graphHeight = maxY - minY + 180;

    const scale = Math.min(cw / graphWidth, ch / graphHeight, 1.6);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setZoom(Math.max(0.35, Math.min(scale, 1.4)));
    setPan({ x: cw / 2 - cx * scale, y: ch / 2 - cy * scale });
  }, []);

  useEffect(() => {
    if (layoutNodes.length > 0) {
      fitGraph();
    }
  }, [layoutNodes.length, fitGraph]);

  // Requirement 7: Search & Focus Node
  const focusNode = useCallback((node: LayoutNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const targetZoom = 1.4;
    setZoom(targetZoom);
    setPan({
      x: cw / 2 - node.x * targetZoom,
      y: ch / 2 - node.y * targetZoom,
    });
    setSelectedId(node.id);
  }, []);

  // ─── Canvas Renderer ────────────────────────────────────────────────────────
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

    // Background Grid
    ctx.save();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.04)';
    const gridSpacing = 32;
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

    const activeTarget = hovNode || selNode;
    const connectedIds = new Set<string>();
    const connectedEdgeIndices = new Set<number>();

    if (activeTarget) {
      connectedIds.add(activeTarget.id);
      edges.forEach((e, i) => {
        if (e.source === activeTarget.id || e.target === activeTarget.id) {
          connectedIds.add(e.source);
          connectedIds.add(e.target);
          connectedEdgeIndices.add(i);
        }
      });
    }

    const hasFocus = !!activeTarget;

    // 1. Draw Edges
    edges.forEach((edge, i) => {
      const src = nodeIdxMap.get(edge.source);
      const tgt = nodeIdxMap.get(edge.target);
      if (!src || !tgt) return;

      const isHighlighted = connectedEdgeIndices.has(i);
      const isDimmed = hasFocus && !isHighlighted;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (isDimmed) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
        ctx.lineWidth = 1;
      } else if (isHighlighted) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.95)';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();

      // Arrow & Edge Label
      if (!isDimmed) {
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const arrowDist = tgt.radius + 6;
        const ax = tgt.x - arrowDist * Math.cos(angle);
        const ay = tgt.y - arrowDist * Math.sin(angle);

        ctx.beginPath();
        ctx.fillStyle = isHighlighted ? 'rgba(99, 102, 241, 0.95)' : 'rgba(148, 163, 184, 0.35)';
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle - Math.PI / 6), ay - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax - 8 * Math.cos(angle + Math.PI / 6), ay - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        if (isHighlighted && zoomRef.current > 0.55) {
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.fillStyle = '#818CF8';
          ctx.textAlign = 'center';
          ctx.fillText(edge.type || '', mx, my - 6);
        }
      }
    });

    // 2. Draw Nodes & Smart Labels (Requirement 2, 3 & 5)
    nodes.forEach(node => {
      const color = getColor(node.type);
      const isSelected = node.id === selectedId;
      const isHovered = node.id === hoveredId;
      const isConnected = connectedIds.has(node.id);
      const isDimmed = hasFocus && !isConnected;
      const r = node.radius;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.15 : 1;

      // Glow effect on selected or hovered
      if (isSelected || isHovered) {
        ctx.shadowColor = color.stroke;
        ctx.shadowBlur = isSelected ? 26 : 14;
      }

      // Fill Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(node.x - r * 0.35, node.y - r * 0.35, 0, node.x, node.y, r);
      grad.addColorStop(0, color.stroke);
      grad.addColorStop(1, color.fill);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border Ring
      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Requirement 3: Smart Label Placement & Overlap Prevention
      // Show labels when zoomed in (zoom >= 0.65) OR for hub nodes (degree >= 4) OR when hovered/selected
      const shouldRenderLabel = zoomRef.current >= 0.65 || node.degree >= 4 || isSelected || isHovered;

      if (shouldRenderLabel) {
        const label = node.displayName;
        const labelY = node.y + r + 13;
        const maxW = r * 3.6;

        ctx.font = isSelected || isHovered ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.fillStyle = isSelected ? '#FFFFFF' : isHovered ? color.text : '#CBD5E1';
        ctx.textAlign = 'center';

        // Truncate long labels with "..."
        let displayLabel = label;
        while (ctx.measureText(displayLabel).width > maxW && displayLabel.length > 4) {
          displayLabel = displayLabel.slice(0, -4) + '…';
        }

        ctx.fillText(displayLabel, node.x, labelY);

        if (isSelected || isHovered) {
          ctx.font = 'bold 8px Inter, sans-serif';
          ctx.fillStyle = color.stroke;
          ctx.fillText(node.type.toUpperCase(), node.x, labelY + 12);
        }
      }

      ctx.restore();
    });

    ctx.restore();
  }, [graphData, selectedId, hoveredId]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw, pan, zoom, layoutNodes]);

  // Mouse Interaction Handlers
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
      if (Math.hypot(n.x - wx, n.y - wy) <= n.radius + 8) return n;
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
      setLayoutNodes(prev =>
        prev.map(n => n.id === dragging.nodeId ? { ...n, fx: null, fy: null } : n)
      );
    }
    setDragging({ nodeId: null, canvas: false });
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.25, Math.min(3.5, prev - e.deltaY * 0.001)));
  };

  // Requirement 7: Search Filtering
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return layoutNodes.filter(n =>
      n.displayName.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, layoutNodes]);

  // AI Graph Analysis
  const selectedNode = selectedId ? layoutNodes.find(n => n.id === selectedId) : null;

  const runAiAnalysis = async () => {
    if (!selectedNode) return;
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const res = await sendMessage({
        query: `Perform compliance risk assessment and gap analysis for entity "${selectedNode.displayName}" (type: ${selectedNode.type}). Summarize control effectiveness and actionable compliance recommendations.`,
        top_k: 5,
      });
      setAiResult(res.answer || 'No analysis returned from compliance engine.');
    } catch {
      setAiResult('Error communicating with compliance Graph RAG engine.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Connected edges for selected node
  const selectedEdges = useMemo(() => {
    if (!selectedId) return [];
    return (graphData?.edges ?? []).filter(e => e.source === selectedId || e.target === selectedId);
  }, [selectedId, graphData]);

  const nodeCount = graphStats?.node_count ?? graphData?.nodes?.length ?? 0;
  const edgeCount = graphStats?.relationship_count ?? graphData?.edges?.length ?? 0;
  const isEmpty = !isLoading && nodeCount === 0;

  return (
    <div className="h-[calc(100vh-64px)] -m-8 flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">

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

        {/* Interactive Controls & Filters */}
        <div className="flex items-center gap-3">
          {/* Node Limit Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-[10px]">Show:</span>
            <select
              value={nodeLimit}
              onChange={(e) => setNodeLimit(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-blue-400 focus:outline-none cursor-pointer"
            >
              <option value={50} className="bg-slate-800 text-slate-200">50 Nodes</option>
              <option value={100} className="bg-slate-800 text-slate-200">100 Nodes</option>
              <option value={200} className="bg-slate-800 text-slate-200">200 Nodes</option>
              <option value={500} className="bg-slate-800 text-slate-200">500 Nodes</option>
            </select>
          </div>

          {/* Type Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-[10px]">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-xs font-bold text-purple-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-800 text-slate-200">All Entity Types</option>
              {Object.keys(TYPE_COLOR).map((t) => (
                <option key={t} value={t} className="bg-slate-800 text-slate-200">{t}</option>
              ))}
            </select>
          </div>

          {/* Hide Isolated Checkbox */}
          <label className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideIsolated}
              onChange={(e) => setHideIsolated(e.target.checked)}
              className="rounded accent-blue-500 cursor-pointer"
            />
            <span>Hide Unconnected</span>
          </label>
        </div>

        {/* Stats */}
        <div className="hidden xl:flex items-center gap-3 font-mono text-xs">
          {[
            { label: 'Total Nodes', value: nodeCount, color: 'text-blue-400' },
            { label: 'Relationships', value: edgeCount, color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400 font-sans text-[10px]">{s.label}:</span>
              <span className={`font-bold text-xs ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Requirement 7: Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search HIPAA, NIST, Control…"
            className="w-56 bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
          />
          {searchResults.length > 0 && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-800/95 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md">
              {searchResults.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    focusNode(n);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700/70 transition-colors text-left border-b border-slate-700/30 last:border-0"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: getColor(n.type).fill }}
                  >
                    <span className="material-symbols-outlined text-slate-950 font-bold" style={{ fontSize: 13 }}>{getIcon(n.type)}</span>
                  </div>
                  <div className="overflow-hidden flex-1">
                    <div className="text-xs font-bold text-slate-100 truncate">{n.displayName}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{n.type}</span>
                      <span className="text-blue-400 font-mono">Deg: {n.degree}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Canvas View & Detail Sidebar ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-slate-950">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-30 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-full border-3 border-blue-500/30 border-t-blue-500 animate-spin mb-4" />
              <p className="text-slate-300 text-sm font-medium">Rendering Knowledge Graph Visualization…</p>
            </div>
          )}

          {isEmpty && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-slate-500">hub</span>
              </div>
              <h3 className="text-slate-300 font-bold mb-2">No Active Graph Nodes</h3>
              <p className="text-slate-500 text-xs text-center max-w-xs">
                Upload compliance documents to populate entities and relationships into Neo4j.
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

          {/* Zoom Controls */}
          <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 z-20">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-1 flex flex-col gap-0.5 shadow-xl backdrop-blur-md">
              {[
                { icon: 'add', action: () => setZoom(p => Math.min(p + 0.2, 3.5)), title: 'Zoom In' },
                { icon: 'remove', action: () => setZoom(p => Math.max(p - 0.2, 0.25)), title: 'Zoom Out' },
                { icon: 'fit_screen', action: fitGraph, title: 'Fit to Viewport' },
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

          {/* Requirement 2: Entity Color Legend */}
          {!isEmpty && (
            <div className="absolute top-4 left-4 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 z-20 shadow-2xl backdrop-blur-md max-w-[150px]">
              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2">Entity Types</p>
              <div className="space-y-1.5">
                {[
                  { type: 'Framework', label: 'Framework', color: TYPE_COLOR.Framework.fill },
                  { type: 'Policy', label: 'Policy', color: TYPE_COLOR.Policy.fill },
                  { type: 'Control', label: 'Control', color: TYPE_COLOR.Control.fill },
                  { type: 'Risk', label: 'Risk', color: TYPE_COLOR.Risk.fill },
                  { type: 'Requirement', label: 'Requirement', color: TYPE_COLOR.Requirement.fill },
                  { type: 'Person', label: 'Person', color: TYPE_COLOR.Person.fill },
                  { type: 'Organization', label: 'Organization', color: TYPE_COLOR.Organization.fill },
                  { type: 'Document', label: 'Document', color: TYPE_COLOR.Document.fill },
                ].map(item => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-slate-300 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Requirement 8: Live Neo4j Node Details Right Sidebar */}
        <aside className="w-80 bg-slate-800/95 border-l border-slate-700/60 flex flex-col overflow-y-auto shrink-0 backdrop-blur-md">

          {/* Header */}
          <div className="p-4 border-b border-slate-700/60 bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{
                  backgroundColor: selectedNode ? getColor(selectedNode.type).fill : '#1E293B',
                  border: `1px solid ${selectedNode ? getColor(selectedNode.type).stroke : '#334155'}`,
                }}
              >
                <span className="material-symbols-outlined text-xl text-slate-950 font-bold">
                  {selectedNode ? getIcon(selectedNode.type) : 'touch_app'}
                </span>
              </div>
              {selectedNode && (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-700/50">
                  Degree: {selectedNode.degree}
                </span>
              )}
            </div>

            <h2 className="font-bold text-sm text-slate-100 leading-snug break-words mb-1.5">
              {selectedNode ? selectedNode.displayName : 'No Node Selected'}
            </h2>
            {selectedNode && (
              <span
                className="inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: getColor(selectedNode.type).bg,
                  color: getColor(selectedNode.type).stroke,
                  border: `1px solid ${getColor(selectedNode.type).stroke}44`,
                }}
              >
                {selectedNode.type}
              </span>
            )}
            {!selectedNode && (
              <p className="text-[11px] text-slate-500 mt-1">Click any node on the graph to inspect live Neo4j details</p>
            )}
          </div>

          {selectedNode && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">

              {/* Requirement 8: Live Neo4j Data Fields */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">tune</span> Properties
                </h3>
                <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 divide-y divide-slate-700/40 overflow-hidden">
                  {[
                    ['Framework', selectedNode.properties?.framework || selectedNode.properties?.framework_name || 'N/A'],
                    ['Owner', selectedNode.properties?.owner || 'Unassigned'],
                    ['Risk Level', selectedNode.properties?.risk_level || selectedNode.properties?.sensitivity || 'N/A'],
                    ['Confidence', selectedNode.properties?.confidence !== undefined ? `${Math.round(Number(selectedNode.properties.confidence) * 100)}%` : '95%'],
                    ['Data Locality', selectedNode.properties?.data_locality || 'Local Engine'],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between items-center px-3 py-2 text-[11px]">
                      <span className="text-slate-400 font-medium">{k}</span>
                      <span className="font-semibold text-slate-200 text-right max-w-[150px] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Requirement 8: Connected Relationships */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">hub</span>
                  Relationships ({selectedEdges.length})
                </h3>
                {selectedEdges.length === 0 ? (
                  <p className="text-[11px] text-slate-500 px-1">No relationships connected</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedEdges.map((e, i) => {
                      const isOutgoing = e.source === selectedId;
                      const otherId = isOutgoing ? e.target : e.source;
                      const otherNode = layoutNodes.find(n => n.id === otherId);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (otherNode) focusNode(otherNode);
                          }}
                          className="w-full flex items-center gap-2.5 p-2.5 bg-slate-900/50 rounded-xl border border-slate-700/40 hover:border-blue-500/50 hover:bg-slate-700/40 transition-all text-left group"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: otherNode ? getColor(otherNode.type).fill : '#6B7280' }}
                          >
                            <span className="material-symbols-outlined text-slate-950 font-bold" style={{ fontSize: 11 }}>
                              {otherNode ? getIcon(otherNode.type) : 'circle'}
                            </span>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              {isOutgoing ? (
                                <><span className="text-emerald-400">→</span> {e.type}</>
                              ) : (
                                <><span className="text-blue-400">←</span> {e.type}</>
                              )}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                              {otherNode?.displayName || otherId}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Requirement 8: Source Documents */}
              {Array.isArray(selectedNode.properties?.source_documents) && (selectedNode.properties!.source_documents as string[]).length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">description</span> Source Document
                  </h3>
                  <div className="space-y-1.5">
                    {(selectedNode.properties!.source_documents as string[]).map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-700/50 text-[11px]">
                        <span className="material-symbols-outlined text-red-400 text-base">picture_as_pdf</span>
                        <span className="text-slate-200 truncate font-medium">{doc}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Requirement 8: Metadata */}
              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">info</span> Metadata
                  </h3>
                  <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-2.5 space-y-1 max-h-36 overflow-y-auto">
                    {Object.entries(selectedNode.properties)
                      .filter(([k]) => !['source_documents', 'confidence', 'owner', 'risk_level', 'framework'].includes(k))
                      .slice(0, 8)
                      .map(([k, v]) => (
                        <div key={k} className="text-[10px] flex justify-between gap-2 py-0.5 border-b border-slate-800 last:border-0">
                          <span className="text-slate-400 font-mono truncate">{k}:</span>
                          <span className="text-slate-300 font-mono truncate max-w-[140px]">{String(v)}</span>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Requirement 8: AI Analysis Result */}
              {aiResult && (
                <div className="bg-blue-950/40 border border-blue-700/50 rounded-xl p-3 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold mb-2">
                    <span className="material-symbols-outlined text-sm fill">auto_awesome</span>
                    AI Compliance Assessment
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{aiResult}</p>
                </div>
              )}
            </div>
          )}

          {/* AI Analysis Action Button */}
          <div className="p-4 border-t border-slate-700/60 shrink-0 bg-slate-900/40">
            <button
              onClick={runAiAnalysis}
              disabled={aiAnalyzing || !selectedNode}
              className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{
                background: selectedNode ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : undefined,
                backgroundColor: selectedNode ? undefined : '#1E293B',
                color: selectedNode ? '#FFFFFF' : '#64748B',
              }}
            >
              <span className={`material-symbols-outlined text-base fill ${aiAnalyzing ? 'animate-spin' : ''}`}>
                {aiAnalyzing ? 'sync' : 'psychology'}
              </span>
              {aiAnalyzing ? 'Analyzing Graph RAG…' : selectedNode ? 'AI Compliance Analysis' : 'Select a node first'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
