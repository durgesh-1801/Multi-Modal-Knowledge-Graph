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

export interface User {
  id: str;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  user_id: string;
  user_name?: string;
  user_email?: string;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  members: ProjectMember[];
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
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  active?: boolean;
}
