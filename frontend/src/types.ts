// ─── RBAC Roles & Status ────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'COMPLIANCE_OFFICER' | 'AUDITOR';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type NavigationTab =
  | 'dashboard'
  | 'projects'
  | 'users'
  | 'upload'
  | 'documents'
  | 'knowledge-graph'
  | 'chat'
  | 'analytics'
  | 'explorer'
  | 'reports'
  | 'settings'
  | 'logs'
  | '403';

// ─── User ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;          // fixed: was `str` (typo)
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  frameworks?: string[];
  owner?: string;
  members: ProjectMember[];
  roles?: string[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  role: string;
  action: string;
  timestamp: string;
  ip_address: string;
  details: string;
}

export interface SystemSettingsData {
  llm_provider: string;
  neo4j_uri: string;
  qdrant_url: string;
  embedding_model: string;
  api_key_status: string;
  theme: string;
  security_audit_mode: boolean;
}

// ─── Dashboard KPI ───────────────────────────────────────────────────────────
export interface KPIMetric {
  id: string;
  title: string;
  value: string;
  change?: string;
  badge?: string;
  icon: string;
  color: 'primary' | 'secondary' | 'tertiary' | 'error';
}

export interface InsightItem {
  id: string;
  title: string;
  description: string;
  type: 'pattern' | 'efficiency' | 'leak' | 'expansion';
  severity?: 'critical' | 'warning' | 'info' | 'success';
}

// ─── Graph Types ─────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  label: string;
  type: 'Department' | 'Policy' | 'Regulation' | 'Risk' | 'Audit' | 'Person' | 'Data';
  x: number;
  y: number;
  status?: 'Compliant' | 'Warning' | 'Breach' | 'Pending';
  version?: string;
  properties?: {
    owner?: string;
    lastReviewed?: string;
    sensitivity?: 'Low' | 'Medium' | 'High' | 'Critical';
    dataLocality?: string;
  };
  relationships?: Array<{
    type: string;
    targetId: string;
    targetLabel: string;
  }>;
  sourceDocs?: Array<{
    name: string;
    size: string;
    updated: string;
  }>;
}

/** Matches backend GraphStatistics schema */
export interface GraphStatistics {
  total_nodes: number;
  total_edges: number;
  node_type_distribution: Record<string, number>;
  avg_degree: number;
  graph_density: number;
  most_connected_entities: Array<{ name?: string; label?: string; degree?: number }>;
  total_documents: number;
  node_count?: number;
  relationship_count?: number;
  document_count?: number;
  average_degree?: number;
  entity_types?: Record<string, number>;
  relationship_types?: Record<string, number>;
}

/** Matches backend SubgraphResponse schema */
export interface BackendGraphNode {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface BackendGraphEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface SubgraphResponse {
  nodes: BackendGraphNode[];
  edges: BackendGraphEdge[];
  metadata?: Record<string, unknown>;
}

// ─── Documents ───────────────────────────────────────────────────────────────
export interface ProcessedDocument {
  id: string;
  uuid: string;
  name: string;
  type: 'pdf' | 'audio' | 'doc' | 'image';
  confidence: number;
  extractedObjectsCount: number;
  entities: string[];
  uploadDate: string;
  status: 'Compliant' | 'Risk Flagged' | 'Processing';
  riskScore?: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  confidence?: number;
  sources?: string[];
  nodes?: string[];
  citations?: string[];
  isStreaming?: boolean;
  processingTime?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  active?: boolean;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface UserProfileResponse {
  user: User;
  permissions: string[];
}
