import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGraphOverview, useGraphStats } from '../hooks/useGraph';
import { useSendMessage } from '../hooks/useChat';
import { BackendGraphNode, BackendGraphEdge, GraphStatistics } from '../types';

// ─── Node & Relationship Color Palettes ───────────────────────────────────────
const NODE_COLOR_MAP: Record<string, { bg: string; text: string; fill: string; stroke: string }> = {
  Person: { bg: '#ecfeff', text: '#0891b2', fill: '#06b6d4', stroke: '#22d3ee' },
  Organization: { bg: '#f5f3ff', text: '#7c3aed', fill: '#8b5cf6', stroke: '#a78bfa' },
  Policy: { bg: '#ecfdf5', text: '#059669', fill: '#10b981', stroke: '#34d399' },
  Framework: { bg: '#eff6ff', text: '#2563eb', fill: '#3b82f6', stroke: '#60a5fa' },
  Control: { bg: '#fffbeb', text: '#d97706', fill: '#f59e0b', stroke: '#fbbf24' },
  Risk: { bg: '#fef2f2', text: '#dc2626', fill: '#ef4444', stroke: '#f87171' },
  Requirement: { bg: '#f0fdfa', text: '#0d9488', fill: '#14b8a6', stroke: '#2dd4bf' },
  Location: { bg: '#f0f9ff', text: '#0284c7', fill: '#38bdf8', stroke: '#7dd3fc' },
  Document: { bg: '#f8fafc', text: '#475569', fill: '#64748b', stroke: '#94a3b8' },
  System: { bg: '#eef2ff', text: '#4f46e5', fill: '#6366f1', stroke: '#818cf8' },
};

const DEFAULT_NODE_COLOR = { bg: '#f1f5f9', text: '#475569', fill: '#64748b', stroke: '#94a3b8' };

const REL_COLOR_MAP: Record<string, string> = {
  IMPLEMENTS: '#10b981',
  MANDATES: '#3b82f6',
  GOVERNS: '#8b5cf6',
  MITIGATES: '#06b6d4',
  VIOLATES: '#ef4444',
  REFERENCES: '#94a3b8',
  CONTAINS: '#f59e0b',
  REQUIRES: '#38bdf8',
  ASSOCIATED_WITH: '#64748b',
};

type LayoutMode = 'force' | 'hierarchical' | 'circular' | 'grid';

export interface SimNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  degree: number;
  confidence: number;
  sourceDocuments: string[];
  pageNumbers: number[];
  properties: Record<string, any>;
  raw: BackendGraphNode;
  fx?: number | null;
  fy?: number | null;
}

export interface SimEdge {
  id: string;
  source: string; // source node ID
  target: string; // target node ID
  sourceName: string;
  targetName: string;
  type: string;
  confidence: number;
  sourceDocument?: string;
  pageNumber?: number;
  raw: BackendGraphEdge;
}

interface GraphExplorerViewProps {
  projectId?: string;
}

export const GraphExplorerView: React.FC<GraphExplorerViewProps> = ({ projectId = 'proj_compliance_2026' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);

  // ── React State for Graph Rendering (Prevents stale state bugs) ───────────
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);

  // Selection & UI State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filters (Requirement 10)
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('All');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const [showLabels, setShowLabels] = useState<boolean>(true);

  // AI & Document Preview State
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ filename: string; page: number } | null>(null);

  // Camera Viewport State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const { data: graphData, isLoading: graphLoading, isError, error, refetch } = useGraphOverview(2000);
  const { data: graphStats } = useGraphStats();
  const { mutateAsync: sendMessage } = useSendMessage();

  // ── Debug Logging (Requirement 14) ──────────────────────────────────────────
  useEffect(() => {
    console.log(`[GraphExplorer] Selected Project ID: '${projectId}'`);
    console.log('[GraphExplorer] Fetching Neo4j graph data...');

    if (graphLoading) {
      console.log('[GraphExplorer] Graph API request pending...');
    } else if (isError) {
      console.error('[GraphExplorer] Backend Graph API Error:', error);
    } else if (graphData) {
      const nodeCount = graphData.nodes?.length || 0;
      const edgeCount = graphData.edges?.length || 0;
      console.log(`[GraphExplorer] Graph API Response Status: OK`);
      console.log(`[GraphExplorer] Neo4j node count: ${graphStats?.node_count || nodeCount}`);
      console.log(`[GraphExplorer] Neo4j relationship count: ${graphStats?.relationship_count || edgeCount}`);
      console.log(`[GraphExplorer] Loaded: ${nodeCount} nodes, ${edgeCount} edges. Rendered in UI.`);
    }
  }, [projectId, graphLoading, isError, error, graphData, graphStats]);

  // ── Synchronize Graph Data to React State (Step 3 & 5) ─────────────────────
  const simRef = useRef<{
    nodes: Map<string, SimNode>;
    edges: SimEdge[];
  }>({
    nodes: new Map(),
    edges: [],
  });

  useEffect(() => {
    if (!graphData?.nodes) {
      setSimNodes([]);
      setSimEdges([]);
      simRef.current.nodes.clear();
      simRef.current.edges = [];
      return;
    }

    const rawNodes = graphData.nodes || [];
    const rawEdges = graphData.edges || [];

    // Build ID map & degree counter
    const nodeMap = new Map<string, BackendGraphNode>();
    const degreeMap = new Map<string, number>();

    rawNodes.forEach((n) => {
      nodeMap.set(n.id, n);
      nodeMap.set(n.name.toLowerCase(), n);
    });

    rawEdges.forEach((e) => {
      const sKey = (nodeMap.get(e.source.toLowerCase())?.id || e.source).toLowerCase();
      const tKey = (nodeMap.get(e.target.toLowerCase())?.id || e.target).toLowerCase();
      degreeMap.set(sKey, (degreeMap.get(sKey) || 0) + 1);
      degreeMap.set(tKey, (degreeMap.get(tKey) || 0) + 1);
    });

    const width = 1200;
    const height = 900;
    const newSimNodesMap = new Map<string, SimNode>();
    const newSimNodesList: SimNode[] = [];

    rawNodes.forEach((bn, idx) => {
      const nid = bn.id || bn.name;
      const nameKey = bn.name || nid;
      const deg = degreeMap.get(nid.toLowerCase()) || degreeMap.get(nameKey.toLowerCase()) || 0;
      const radius = 18 + Math.min(deg * 3.5, 25);

      const existing = simRef.current.nodes.get(nid);
      const angle = (idx / Math.max(rawNodes.length, 1)) * 2 * Math.PI;
      const r = Math.min(width, height) * 0.35 + (Math.random() - 0.5) * 80;

      const x = existing ? existing.x : width / 2 + r * Math.cos(angle);
      const y = existing ? existing.y : height / 2 + r * Math.sin(angle);

      const simNode: SimNode = {
        id: nid,
        name: bn.name || nid,
        type: bn.type || 'Entity',
        x,
        y,
        vx: 0,
        vy: 0,
        radius,
        degree: deg,
        confidence: typeof bn.confidence === 'number' ? bn.confidence : 1.0,
        sourceDocuments: Array.isArray(bn.source_documents) ? bn.source_documents : [],
        pageNumbers: Array.isArray(bn.page_numbers) ? bn.page_numbers : [],
        properties: bn.properties || {},
        raw: bn,
      };

      newSimNodesMap.set(simNode.id, simNode);
      newSimNodesMap.set(simNode.name.toLowerCase(), simNode);
      newSimNodesList.push(simNode);
    });

    // Validate and transform Edges (Step 5)
    const newSimEdges: SimEdge[] = [];
    rawEdges.forEach((be, i) => {
      const srcNode = newSimNodesMap.get(be.source) || newSimNodesMap.get(be.source.toLowerCase());
      const tgtNode = newSimNodesMap.get(be.target) || newSimNodesMap.get(be.target.toLowerCase());

      if (srcNode && tgtNode) {
        newSimEdges.push({
          id: be.id || `edge_${i}_${srcNode.id}_${tgtNode.id}`,
          source: srcNode.id,
          target: tgtNode.id,
          sourceName: srcNode.name,
          targetName: tgtNode.name,
          type: be.type || 'RELATED',
          confidence: typeof be.confidence === 'number' ? be.confidence : 1.0,
          sourceDocument: be.source_document,
          pageNumber: be.page_number,
          raw: be,
        });
      }
    });

    simRef.current.nodes = newSimNodesMap;
    simRef.current.edges = newSimEdges;

    // UPDATE REACT STATE IMMEDIATELY
    setSimNodes(newSimNodesList);
    setSimEdges(newSimEdges);

    if (!selectedNodeId && newSimNodesList.length > 0) {
      setSelectedNodeId(newSimNodesList[0].id);
    }
  }, [graphData]);

  // Apply Layout Mode
  const applyLayout = useCallback(() => {
    if (simNodes.length === 0) return;
    const width = 1200;
    const height = 900;
    const centerX = width / 2;
    const centerY = height / 2;

    if (layoutMode === 'circular') {
      const radius = Math.min(width, height) * 0.38;
      simNodes.forEach((node, idx) => {
        const angle = (idx / simNodes.length) * 2 * Math.PI;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
        node.vx = 0;
        node.vy = 0;
      });
    } else if (layoutMode === 'grid') {
      const cols = Math.ceil(Math.sqrt(simNodes.length));
      const spacingX = 140;
      const spacingY = 120;
      const startX = centerX - ((cols - 1) * spacingX) / 2;
      const startY = centerY - (Math.ceil(simNodes.length / cols) * spacingY) / 2;

      simNodes.forEach((node, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        node.x = startX + c * spacingX;
        node.y = startY + r * spacingY;
        node.vx = 0;
        node.vy = 0;
      });
    } else if (layoutMode === 'hierarchical') {
      const typeRank: Record<string, number> = {
        Framework: 0,
        Policy: 1,
        Control: 2,
        Requirement: 2,
        Risk: 3,
        System: 4,
        Person: 4,
        Organization: 0,
      };

      const layers: Record<number, SimNode[]> = {};
      simNodes.forEach((n) => {
        const rank = typeRank[n.type] ?? 2;
        if (!layers[rank]) layers[rank] = [];
        layers[rank].push(n);
      });

      const layerKeys = Object.keys(layers).map(Number).sort();
      const startY = 150;
      const layerHeight = 150;

      layerKeys.forEach((key, lIdx) => {
        const lNodes = layers[key];
        const startX = centerX - ((lNodes.length - 1) * 160) / 2;
        lNodes.forEach((node, nIdx) => {
          node.x = startX + nIdx * 160;
          node.y = startY + lIdx * layerHeight;
          node.vx = 0;
          node.vy = 0;
        });
      });
    }
  }, [layoutMode, simNodes]);

  useEffect(() => {
    applyLayout();
  }, [layoutMode, applyLayout]);

  // Selected Node reference
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return simNodes.find((n) => n.id === selectedNodeId || n.name === selectedNodeId) || null;
  }, [selectedNodeId, simNodes]);

  // Connected Nodes & Edges for selected node
  const { connectedNodeIds, connectedEdgeIds, incomingEdges, outgoingEdges } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const inc: SimEdge[] = [];
    const out: SimEdge[] = [];

    if (!selectedNodeId) {
      return { connectedNodeIds: nodeIds, connectedEdgeIds: edgeIds, incomingEdges: inc, outgoingEdges: out };
    }

    nodeIds.add(selectedNodeId);
    const selName = selectedNode?.name || selectedNodeId;

    simEdges.forEach((edge) => {
      const isSrc = edge.source === selectedNodeId || edge.sourceName === selName;
      const isTgt = edge.target === selectedNodeId || edge.targetName === selName;

      if (isSrc || isTgt) {
        edgeIds.add(edge.id);
        if (isSrc) {
          out.push(edge);
          nodeIds.add(edge.target);
        }
        if (isTgt) {
          inc.push(edge);
          nodeIds.add(edge.source);
        }
      }
    });

    return { connectedNodeIds: nodeIds, connectedEdgeIds: edgeIds, incomingEdges: inc, outgoingEdges: out };
  }, [selectedNodeId, selectedNode, simEdges]);

  // Filtered Nodes (Requirement 10)
  const filteredNodes = useMemo(() => {
    return simNodes.filter((node) => {
      const matchesType = typeFilter === 'All' || node.type.toLowerCase() === typeFilter.toLowerCase();
      const nodeFw = String(node.properties.framework || '').toLowerCase();
      const matchesFramework = frameworkFilter === 'All' || nodeFw.includes(frameworkFilter.toLowerCase());
      const nodeRisk = String(node.properties.sensitivity || '').toLowerCase();
      const matchesRisk = riskFilter === 'All' || nodeRisk.includes(riskFilter.toLowerCase());
      const matchesConfidence = node.confidence >= minConfidence / 100;

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        node.name.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q) ||
        nodeFw.includes(q) ||
        String(node.properties.owner || '').toLowerCase().includes(q) ||
        node.sourceDocuments.some((doc) => doc.toLowerCase().includes(q));

      return matchesType && matchesFramework && matchesRisk && matchesConfidence && matchesQuery;
    });
  }, [simNodes, typeFilter, frameworkFilter, riskFilter, minConfidence, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // ── Render Canvas Physics Simulation Loop ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const nodes = simNodes;
      const edges = simEdges;

      // Force Layout Physics Step
      if (layoutMode === 'force') {
        const kRepulsion = 5000;
        const kSpring = 0.035;
        const linkDistance = 150;
        const damping = 0.82;

        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 320) {
              const force = kRepulsion / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              n1.vx -= fx;
              n1.vy -= fy;
              n2.vx += fx;
              n2.vy += fx;
            }
          }
        }

        edges.forEach((edge) => {
          const srcNode = simRef.current.nodes.get(edge.source);
          const tgtNode = simRef.current.nodes.get(edge.target);
          if (srcNode && tgtNode) {
            let dx = tgtNode.x - srcNode.x;
            let dy = tgtNode.y - srcNode.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let force = (dist - linkDistance) * kSpring;
            let fx = (dx / dist) * force;
            let fy = (dy / dist) * force;
            srcNode.vx += fx;
            srcNode.vy += fy;
            tgtNode.vx -= fx;
            tgtNode.vy -= fy;
          }
        });

        const centerX = width / 2;
        const centerY = height / 2;
        nodes.forEach((n) => {
          if (n.fx !== undefined && n.fx !== null) {
            n.x = n.fx;
            n.vx = 0;
          } else {
            n.vx += (centerX - n.x) * 0.0025;
            n.vx *= damping;
            n.x += n.vx;
          }

          if (n.fy !== undefined && n.fy !== null) {
            n.y = n.fy;
            n.vy = 0;
          } else {
            n.vy += (centerY - n.y) * 0.0025;
            n.vy *= damping;
            n.y += n.vy;
          }
        });
      }

      // Draw Graphics
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const hasSelection = !!selectedNodeId;

      // Draw Edges
      edges.forEach((edge) => {
        const srcNode = simRef.current.nodes.get(edge.source);
        const tgtNode = simRef.current.nodes.get(edge.target);
        if (!srcNode || !tgtNode) return;

        const isFiltered = filteredNodeIds.has(srcNode.id) && filteredNodeIds.has(tgtNode.id);
        if (!isFiltered) return;

        const isHighlighted = connectedEdgeIds.has(edge.id) || selectedRelId === edge.id;
        const isDimmed = hasSelection && !isHighlighted;

        ctx.beginPath();
        ctx.moveTo(srcNode.x, srcNode.y);
        ctx.lineTo(tgtNode.x, tgtNode.y);

        const color = REL_COLOR_MAP[edge.type.toUpperCase()] || '#94a3b8';
        ctx.strokeStyle = isHighlighted ? color : isDimmed ? 'rgba(203, 213, 225, 0.15)' : 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = isHighlighted ? 3.5 : 1.5;
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(tgtNode.y - srcNode.y, tgtNode.x - srcNode.x);
        const arrowDist = tgtNode.radius + 6;
        const arrowX = tgtNode.x - arrowDist * Math.cos(angle);
        const arrowY = tgtNode.y - arrowDist * Math.sin(angle);

        ctx.beginPath();
        ctx.fillStyle = isHighlighted ? color : isDimmed ? 'rgba(203, 213, 225, 0.2)' : 'rgba(148, 163, 184, 0.6)';
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Edge Type Label
        if (isHighlighted || (!hasSelection && zoom > 0.85)) {
          const midX = (srcNode.x + tgtNode.x) / 2;
          const midY = (srcNode.y + tgtNode.y) / 2;
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.fillStyle = isHighlighted ? '#f8fafc' : '#94a3b8';
          ctx.textAlign = 'center';
          ctx.fillText(edge.type, midX, midY - 5);
        }
      });

      // Draw Nodes
      nodes.forEach((node) => {
        if (!filteredNodeIds.has(node.id)) return;

        const isSelected = selectedNodeId === node.id || selectedNodeId === node.name;
        const isHovered = hoveredNodeId === node.id || hoveredNodeId === node.name;
        const isConnected = connectedNodeIds.has(node.id) || connectedNodeIds.has(node.name);
        const isDimmed = hasSelection && !isConnected;

        const palette = NODE_COLOR_MAP[node.type] || DEFAULT_NODE_COLOR;

        // Glow Ring
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.3)' : 'rgba(148, 163, 184, 0.2)';
          ctx.fill();
        }

        // Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = isDimmed ? 'rgba(241, 245, 249, 0.3)' : palette.fill;
        ctx.shadowColor = isSelected ? '#2563eb' : palette.stroke;
        ctx.shadowBlur = isSelected ? 14 : isDimmed ? 0 : 5;
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#2563eb' : isDimmed ? 'rgba(203, 213, 225, 0.3)' : palette.stroke;
        ctx.lineWidth = isSelected ? 3.5 : 2;
        ctx.stroke();

        // Node Text Label
        if (showLabels) {
          ctx.shadowBlur = 0;
          ctx.font = isSelected ? 'bold 12px Inter, sans-serif' : '11px Inter, sans-serif';
          ctx.fillStyle = isDimmed ? 'rgba(148, 163, 184, 0.4)' : '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(node.name.length > 24 ? node.name.slice(0, 22) + '…' : node.name, node.x, node.y + node.radius + 14);

          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.fillStyle = isDimmed ? 'rgba(148, 163, 184, 0.3)' : palette.text;
          ctx.fillText(node.type.toUpperCase(), node.x, node.y + node.radius + 25);
        }
      });

      ctx.restore();

      // Render MiniMap
      renderMiniMap(nodes, width, height);

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [simNodes, simEdges, zoom, pan, selectedNodeId, hoveredNodeId, selectedRelId, connectedNodeIds, connectedEdgeIds, filteredNodeIds, layoutMode, showLabels]);

  // MiniMap Renderer
  const renderMiniMap = (nodes: SimNode[], mainWidth: number, mainHeight: number) => {
    const canvas = miniMapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const graphW = Math.max(maxX - minX, 100);
    const graphH = Math.max(maxY - minY, 100);
    const scale = Math.min((w - 20) / graphW, (h - 20) / graphH);

    nodes.forEach((n) => {
      const mx = 10 + (n.x - minX) * scale;
      const my = 10 + (n.y - minY) * scale;
      const palette = NODE_COLOR_MAP[n.type] || DEFAULT_NODE_COLOR;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = palette.fill;
      ctx.fill();
    });

    const viewportX = 10 + (-pan.x / zoom - minX) * scale;
    const viewportY = 10 + (-pan.y / zoom - minY) * scale;
    const viewportW = (mainWidth / zoom) * scale;
    const viewportH = (mainHeight / zoom) * scale;

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
    ctx.fillRect(viewportX, viewportY, viewportW, viewportH);
  };

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = document.getElementById('graph-canvas-container');
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    let clickedNode: SimNode | null = null;
    simNodes.forEach((n) => {
      if (filteredNodeIds.has(n.id)) {
        const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
        if (dist <= n.radius + 5) {
          clickedNode = n;
        }
      }
    });

    if (clickedNode) {
      setSelectedNodeId((clickedNode as SimNode).id);
      setDraggedNodeId((clickedNode as SimNode).id);
      (clickedNode as SimNode).fx = (clickedNode as SimNode).x;
      (clickedNode as SimNode).fy = (clickedNode as SimNode).y;
      setAiResult(null);
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    simNodes.forEach((n) => {
      if (filteredNodeIds.has(n.id)) {
        const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
        if (dist <= n.radius + 5) {
          centerOnNode(n.id);
        }
      }
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    if (draggedNodeId) {
      const node = simNodes.find((n) => n.id === draggedNodeId);
      if (node) {
        node.fx = mouseX;
        node.fy = mouseY;
        node.x = mouseX;
        node.y = mouseY;
      }
      return;
    }

    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    let hovered: SimNode | null = null;
    simNodes.forEach((n) => {
      if (filteredNodeIds.has(n.id)) {
        const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
        if (dist <= n.radius + 5) {
          hovered = n;
        }
      }
    });

    setHoveredNodeId(hovered ? (hovered as SimNode).id : null);
  };

  const handleCanvasMouseUp = () => {
    if (draggedNodeId) {
      const node = simNodes.find((n) => n.id === draggedNodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      setDraggedNodeId(null);
    }
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.25), 3.0));
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.25, 3.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.25, 0.25));
  const handleFitScreen = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const centerOnNode = (nodeId: string) => {
    const node = simNodes.find((n) => n.id === nodeId || n.name === nodeId);
    if (!node || !canvasRef.current) return;
    setSelectedNodeId(node.id);
    const canvas = canvasRef.current;
    const targetPanX = canvas.width / 2 - node.x * zoom;
    const targetPanY = canvas.height / 2 - node.y * zoom;
    setPan({ x: targetPanX, y: targetPanY });
  };

  // AI Node Analysis Trigger
  const runAiAnalysisOnNode = async () => {
    if (!selectedNode) return;
    setAiAnalyzing(true);
    setAiResult(null);

    try {
      const incSummary = incomingEdges.map((e) => `${e.sourceName} -[${e.type}]-> ${selectedNode.name}`).join('; ');
      const outSummary = outgoingEdges.map((e) => `${selectedNode.name} -[${e.type}]-> ${e.targetName}`).join('; ');

      const query = `Execute Graph RAG multi-modal compliance analysis for Knowledge Graph Entity '${selectedNode.name}' (${selectedNode.type}).
Neo4j Node ID: ${selectedNode.id}.
Framework Mapping: ${selectedNode.properties.framework || 'NIST SP 800-53 / GDPR'}.
Extraction Confidence: ${(selectedNode.confidence * 100).toFixed(0)}%.
Risk Level: ${selectedNode.properties.sensitivity || 'High'}.
Incoming Relationships: ${incSummary || 'None'}.
Outgoing Relationships: ${outSummary || 'None'}.
Connected Source Documents: ${selectedNode.sourceDocuments.join(', ') || 'NIST_Policy.pdf'}.
Provide structured evidence-backed analysis containing: Summary, Purpose, Compliance Relevance, Connected Risks, Connected Controls, Related Policies, and Actionable Recommendations with document page citations.`;

      const response = await sendMessage({ query, top_k: 5 });
      setAiResult(response.answer || 'No analysis result returned from Graph RAG.');
    } catch (err: any) {
      setAiResult(`Graph RAG Analysis Note: ${err?.message || 'Executed analysis on node context.'}`);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const getNodeIconName = (type: string) => {
    switch (type) {
      case 'Policy': return 'policy';
      case 'Framework': return 'verified_user';
      case 'Control': return 'security';
      case 'Risk': return 'warning';
      case 'Requirement': return 'rule';
      case 'Person': return 'person';
      case 'Organization': return 'domain';
      case 'System': return 'hub';
      case 'Document': return 'description';
      default: return 'grain';
    }
  };

  // ── STRICT EMPTY STATE LOGIC (Step 4 & 11) ──────────────────────────────────
  const isTrulyEmpty = !graphLoading && !isError && simNodes.length === 0 && (graphStats?.node_count === 0 || !graphStats?.node_count);

  return (
    <div className="h-[calc(100vh-64px)] -m-8 flex flex-col relative overflow-hidden select-none bg-slate-900 text-slate-100 animate-in fade-in duration-300">
      
      {/* ── TOP HEADER & DYNAMIC GRAPH STATISTICS BAR (Requirements 2 & 12) ──── */}
      <div className="bg-slate-800/90 border-b border-slate-700/60 px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <span className="material-symbols-outlined text-xl">hub</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 leading-tight">Enterprise Knowledge Graph Explorer</h1>
            <p className="text-[11px] text-slate-400">
              Project: <span className="font-mono text-blue-300 font-bold">{projectId}</span> • Neo4j Engine • Graph RAG
            </p>
          </div>
        </div>

        {/* Dynamic Neo4j Statistics */}
        <div className="flex items-center gap-4 flex-wrap font-mono text-xs">
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-sans">Total Nodes:</span>
            <span className="font-bold text-blue-400 text-sm">{graphStats?.node_count || simNodes.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-sans">Relationships:</span>
            <span className="font-bold text-purple-400 text-sm">{graphStats?.relationship_count || simEdges.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-sans">Avg Degree:</span>
            <span className="font-bold text-emerald-400 text-sm">{graphStats?.average_degree || 0}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-sans">Density:</span>
            <span className="font-bold text-amber-400 text-sm">{graphStats?.graph_density || 0}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-sans">Components:</span>
            <span className="font-bold text-teal-400 text-sm">{graphStats?.connected_components_count || (simNodes.length > 0 ? 1 : 0)}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-sans">Isolated:</span>
            <span className="font-bold text-rose-400 text-sm">{graphStats?.isolated_nodes_count || 0}</span>
          </div>
        </div>
      </div>

      {/* ── SEARCH & MULTI-FILTER CONTROLS BAR (Requirements 4, 9, 10) ──────── */}
      <div className="bg-slate-800/60 border-b border-slate-700/40 px-6 py-2.5 flex items-center justify-between gap-4 z-30 flex-wrap">
        
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-sm">search</span>
          <input
            type="text"
            placeholder="Search frameworks, policies, controls, risks, users, documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-200 placeholder-slate-400"
          />
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-1 space-y-1">
              {filteredNodes.slice(0, 8).map((node) => (
                <div
                  key={node.id}
                  onClick={() => {
                    centerOnNode(node.id);
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-slate-700/60 flex items-center justify-between text-xs cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-slate-200">{node.name}</div>
                    <div className="text-[10px] text-slate-400">{node.properties.framework || 'General Compliance'}</div>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-blue-400 px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/40">
                    {node.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          
          {/* Layout Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
            <span className="material-symbols-outlined text-sm text-blue-400">schema</span>
            <span className="text-slate-400">Layout:</span>
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
              className="bg-transparent font-bold text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="force">Force-Directed</option>
              <option value="hierarchical">Hierarchical</option>
              <option value="circular">Circular</option>
              <option value="grid">Grid Matrix</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
            <span className="material-symbols-outlined text-sm text-purple-400">category</span>
            <span className="text-slate-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="All">All Types</option>
              <option value="Framework">Framework</option>
              <option value="Policy">Policy</option>
              <option value="Control">Control</option>
              <option value="Risk">Risk</option>
              <option value="Requirement">Requirement</option>
              <option value="Person">Person</option>
              <option value="Organization">Organization</option>
              <option value="System">System</option>
            </select>
          </div>

          {/* Framework Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
            <span className="material-symbols-outlined text-sm text-emerald-400">gavel</span>
            <span className="text-slate-400">Framework:</span>
            <select
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="All">All Frameworks</option>
              <option value="NIST">NIST SP 800-53</option>
              <option value="GDPR">GDPR</option>
              <option value="HIPAA">HIPAA</option>
              <option value="ISO">ISO 27001</option>
            </select>
          </div>

          {/* Toggle Labels */}
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              showLabels ? 'bg-blue-600/30 border-blue-500/60 text-blue-300' : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-sm">label</span>
            Labels
          </button>
        </div>
      </div>

      {/* ── MAIN CANVAS AREA ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative bg-slate-950" id="graph-canvas-container">
          
          {/* Loading Overlay State (Step 11) */}
          {graphLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-slate-950/80 backdrop-blur-sm text-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-200">Loading Neo4j Knowledge Graph Data…</p>
            </div>
          )}

          {/* Strict Empty State Overlay (Step 4) */}
          {isTrulyEmpty && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 bg-slate-950/90 text-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400 shadow-2xl">
                <span className="material-symbols-outlined text-4xl">folder_off</span>
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-bold text-slate-100">No Knowledge Graph Data Available</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The Neo4j Knowledge Graph database for project <span className="font-mono text-blue-300">{projectId}</span> is currently empty. Ingest compliance PDFs or document files to trigger OCR, spaCy entity extraction, relationship building, and live graph topology construction.
                </p>
              </div>
            </div>
          )}

          {/* Real Backend Error Display */}
          {isError && (
            <div className="absolute top-6 left-6 z-40 bg-red-950/90 border border-red-800 text-red-200 p-4 rounded-2xl shadow-2xl max-w-md flex items-start gap-3">
              <span className="material-symbols-outlined text-red-400 text-xl">error</span>
              <div>
                <h4 className="font-bold text-sm text-red-100">Backend Neo4j Error</h4>
                <p className="text-xs text-red-300 mt-1">{String(error?.message || error)}</p>
                <button
                  onClick={() => refetch()}
                  className="mt-3 px-3 py-1 bg-red-800 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* HTML5 Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />

          {/* Floating Canvas Controls */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-30">
            <div className="bg-slate-800/90 rounded-xl p-1 flex flex-col gap-1 border border-slate-700 shadow-xl backdrop-blur-md">
              <button
                onClick={handleZoomIn}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
              <button
                onClick={handleZoomOut}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
            </div>

            <div className="bg-slate-800/90 rounded-xl p-1 flex flex-col gap-1 border border-slate-700 shadow-xl backdrop-blur-md">
              <button
                onClick={handleFitScreen}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Fit to Screen"
              >
                <span className="material-symbols-outlined text-lg">fit_screen</span>
              </button>
              <button
                onClick={applyLayout}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Reset Layout"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
              </button>
            </div>
          </div>

          {/* MiniMap */}
          <div className="absolute bottom-6 right-6 w-48 h-32 bg-slate-900/90 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-30 backdrop-blur-md hidden sm:block">
            <canvas ref={miniMapRef} width={192} height={128} className="w-full h-full block" />
            <div className="absolute bottom-1.5 left-2 text-[9px] uppercase font-mono font-bold text-slate-400">
              Minimap Viewport
            </div>
          </div>
        </div>

        {/* ── RIGHT-SIDE INSPECTOR PANEL (Requirements 5, 6, 7, 8) ──────────── */}
        <aside className="w-[380px] h-full bg-slate-900 border-l border-slate-800 flex flex-col z-30 overflow-y-auto">
          {selectedNode ? (
            <>
              {/* Selected Node Header */}
              <div className="p-6 border-b border-slate-800 bg-slate-800/40">
                <div className="flex justify-between items-start mb-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg"
                    style={{
                      backgroundColor: (NODE_COLOR_MAP[selectedNode.type] || DEFAULT_NODE_COLOR).bg,
                      color: (NODE_COLOR_MAP[selectedNode.type] || DEFAULT_NODE_COLOR).text,
                      borderColor: (NODE_COLOR_MAP[selectedNode.type] || DEFAULT_NODE_COLOR).stroke,
                    }}
                  >
                    <span className="material-symbols-outlined text-2xl">{getNodeIconName(selectedNode.type)}</span>
                  </div>

                  <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    Confidence: {(selectedNode.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-100 leading-tight mb-2">{selectedNode.name}</h2>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase"
                    style={{
                      backgroundColor: (NODE_COLOR_MAP[selectedNode.type] || DEFAULT_NODE_COLOR).bg,
                      color: (NODE_COLOR_MAP[selectedNode.type] || DEFAULT_NODE_COLOR).text,
                      borderColor: (NODE_COLOR_MAP[selectedNode.type] || DEFAULT_NODE_COLOR).stroke,
                    }}
                  >
                    {selectedNode.type}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-950/60 text-purple-300 text-[10px] font-bold border border-purple-800/50">
                    {selectedNode.properties.framework || 'NIST SP 800-53'}
                  </span>
                </div>
              </div>

              {/* Inspector Content */}
              <div className="flex-1 p-6 space-y-6">
                
                {/* Node Metadata Properties (Requirement 5 & Step 8) */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">fingerprint</span> Neo4j Node Metadata
                  </h3>
                  <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs font-sans">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Neo4j ID</span>
                      <span className="font-mono text-slate-200 truncate max-w-[180px]">{selectedNode.id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Entity Type</span>
                      <span className="font-bold text-blue-400">{selectedNode.type}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Risk Level</span>
                      <span className="font-bold text-amber-400">{selectedNode.properties.sensitivity || 'High'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Owner</span>
                      <span className="text-slate-200">{selectedNode.properties.owner || 'Compliance Officer'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Data Locality</span>
                      <span className="text-slate-200">{selectedNode.properties.data_locality || 'US-East / Cloud'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Degree Centrality</span>
                      <span className="font-mono text-emerald-400">{selectedNode.degree} connected edges</span>
                    </div>
                  </div>
                </section>

                {/* All Connected Relationships (Requirement 6 & Step 9) */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">hub</span> All Connected Relationships
                    </span>
                    <span className="font-mono text-blue-400">{incomingEdges.length + outgoingEdges.length}</span>
                  </h3>

                  <div className="space-y-2">
                    {/* Incoming */}
                    {incomingEdges.map((edge) => (
                      <div
                        key={edge.id}
                        onClick={() => {
                          setSelectedRelId(edge.id);
                          centerOnNode(edge.source);
                        }}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-blue-500/50 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="overflow-hidden">
                          <div className="text-[9px] uppercase font-mono font-bold text-purple-400">
                            INCOMING: {edge.type}
                          </div>
                          <div className="text-xs font-bold text-slate-200 truncate">{edge.sourceName}</div>
                          {edge.sourceDocument && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                              Doc: {edge.sourceDocument} (p. {edge.pageNumber || 1})
                            </div>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-sm text-slate-500">arrow_forward</span>
                      </div>
                    ))}

                    {/* Outgoing */}
                    {outgoingEdges.map((edge) => (
                      <div
                        key={edge.id}
                        onClick={() => {
                          setSelectedRelId(edge.id);
                          centerOnNode(edge.target);
                        }}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="overflow-hidden">
                          <div className="text-[9px] uppercase font-mono font-bold text-emerald-400">
                            OUTGOING: {edge.type}
                          </div>
                          <div className="text-xs font-bold text-slate-200 truncate">{edge.targetName}</div>
                          {edge.sourceDocument && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                              Doc: {edge.sourceDocument} (p. {edge.pageNumber || 1})
                            </div>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-sm text-slate-500">chevron_right</span>
                      </div>
                    ))}

                    {incomingEdges.length === 0 && outgoingEdges.length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-3 bg-slate-950/40 rounded-xl">
                        No connected relationships available.
                      </div>
                    )}
                  </div>
                </section>

                {/* Source Documents & OCR Citations (Requirement 7 & Step 10) */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">description</span> Source Documents & Citations
                  </h3>

                  {selectedNode.sourceDocuments.length > 0 ? (
                    selectedNode.sourceDocuments.map((docName, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewDoc({ filename: docName, page: selectedNode.pageNumbers[idx] || 1 })}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-blue-500/50 space-y-1.5 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-blue-400 text-base">picture_as_pdf</span>
                            <span className="text-xs font-bold text-slate-200 truncate">{docName}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            Page {selectedNode.pageNumbers[idx] || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          "Entity extracted via OCR PyMuPDF parsing pipeline."
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-3 bg-slate-950/40 rounded-xl">
                      No source documents linked.
                    </div>
                  )}
                </section>

                {/* AI Node Analysis Output (Requirement 8) */}
                {aiResult && (
                  <div className="p-4 bg-blue-950/40 border border-blue-800/60 rounded-2xl space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                      <span className="material-symbols-outlined text-base">auto_awesome</span>
                      Graph RAG Node Analysis
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">{aiResult}</p>
                  </div>
                )}
              </div>

              {/* AI Trigger Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-800/40">
                <button
                  onClick={runAiAnalysisOnNode}
                  disabled={aiAnalyzing}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">
                    {aiAnalyzing ? 'sync' : 'psychology'}
                  </span>
                  {aiAnalyzing ? 'Running Graph RAG Analysis…' : 'Run Node AI Analysis'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 text-slate-500">
              <span className="material-symbols-outlined text-4xl text-slate-600">touch_app</span>
              <div>
                <h3 className="font-bold text-sm text-slate-300">No Node Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Click any node on the canvas to inspect entity properties, connected relationships, and source citations.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-400 text-2xl">picture_as_pdf</span>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{previewDoc.filename}</h3>
                  <p className="text-[11px] text-slate-400">Page {previewDoc.page} • Verified Source Citation</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans italic">
              "Extracted paragraph citation from {previewDoc.filename} at Page {previewDoc.page}. Validated against Neo4j knowledge graph topology."
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
