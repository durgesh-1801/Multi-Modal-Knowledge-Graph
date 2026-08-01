/**
 * useGraph — hooks for /api/v1/graph
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';
import { GraphStatistics, SubgraphResponse, BackendGraphNode } from '../types';

// ─── Default fallback structures ──────────────────────────────────────────────
export const DEFAULT_GRAPH_STATS: GraphStatistics = {
  total_nodes: 0,
  total_edges: 0,
  node_type_distribution: {},
  avg_degree: 0,
  graph_density: 0,
  most_connected_entities: [],
};

export const DEFAULT_SUBGRAPH_RESPONSE: SubgraphResponse = {
  nodes: [],
  edges: [],
  metadata: {},
};

// ─── Full graph overview ──────────────────────────────────────────────────────
export function useGraphOverview(limit = 50) {
  const query = useQuery({
    queryKey: ['graph', 'overview', limit],
    queryFn: async (): Promise<SubgraphResponse> => {
      try {
        const res = await apiClient.get<ApiResponse<SubgraphResponse>>('/graph', {
          params: { limit },
        });
        const data = res.data?.data;
        return {
          nodes: Array.isArray(data?.nodes) ? data.nodes : [],
          edges: Array.isArray(data?.edges) ? data.edges : [],
          metadata: data?.metadata || {},
        };
      } catch {
        return DEFAULT_SUBGRAPH_RESPONSE;
      }
    },
    retry: 1,
    staleTime: 30_000, // 30 seconds
  });

  return {
    ...query,
    data: query.data ?? DEFAULT_SUBGRAPH_RESPONSE,
  };
}

// ─── Entity subgraph ──────────────────────────────────────────────────────────
export function useSubgraph(entityId: string | null, depth = 2) {
  const query = useQuery({
    queryKey: ['graph', 'subgraph', entityId, depth],
    queryFn: async (): Promise<SubgraphResponse> => {
      try {
        const res = await apiClient.get<ApiResponse<SubgraphResponse>>('/graph/subgraph', {
          params: { entity_id: entityId, depth },
        });
        const data = res.data?.data;
        return {
          nodes: Array.isArray(data?.nodes) ? data.nodes : [],
          edges: Array.isArray(data?.edges) ? data.edges : [],
          metadata: data?.metadata || {},
        };
      } catch {
        return DEFAULT_SUBGRAPH_RESPONSE;
      }
    },
    enabled: !!entityId,
    retry: 1,
  });

  return {
    ...query,
    data: query.data ?? DEFAULT_SUBGRAPH_RESPONSE,
  };
}

// ─── Graph search ─────────────────────────────────────────────────────────────
export function useGraphSearch(query: string) {
  const queryResult = useQuery({
    queryKey: ['graph', 'search', query],
    queryFn: async (): Promise<BackendGraphNode[]> => {
      try {
        const res = await apiClient.get<ApiResponse<BackendGraphNode[]>>('/graph/search', {
          params: { query },
        });
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    enabled: query.trim().length > 1,
    retry: 1,
    staleTime: 10_000,
  });

  return {
    ...queryResult,
    data: queryResult.data ?? [],
  };
}

// ─── Graph statistics (for Dashboard + Analytics) ────────────────────────────
export function useGraphStats() {
  const query = useQuery({
    queryKey: ['graph', 'statistics'],
    queryFn: async (): Promise<GraphStatistics> => {
      try {
        const res = await apiClient.get<ApiResponse<GraphStatistics>>('/graph/statistics');
        const data = res.data?.data;
        return {
          total_nodes: typeof data?.total_nodes === 'number' ? data.total_nodes : 0,
          total_edges: typeof data?.total_edges === 'number' ? data.total_edges : 0,
          node_type_distribution: data?.node_type_distribution || {},
          avg_degree: typeof data?.avg_degree === 'number' ? data.avg_degree : 0,
          graph_density: typeof data?.graph_density === 'number' ? data.graph_density : 0,
          most_connected_entities: Array.isArray(data?.most_connected_entities) ? data.most_connected_entities : [],
        };
      } catch {
        return DEFAULT_GRAPH_STATS;
      }
    },
    retry: 2,
    staleTime: 60_000, // 1 minute
  });

  return {
    ...query,
    data: query.data ?? DEFAULT_GRAPH_STATS,
  };
}

