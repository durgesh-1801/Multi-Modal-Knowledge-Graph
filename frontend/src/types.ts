export type NavigationTab = 
  | 'dashboard'
  | 'upload'
  | 'documents'
  | 'knowledge-graph'
  | 'chat'
  | 'analytics'
  | 'explorer'
  | 'settings';

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
