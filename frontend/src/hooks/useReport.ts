/**
 * useReport — Custom React Query hooks & API helpers for calling backend /api/v1/reports endpoints.
 *
 * Single source of truth for:
 *  - useReports(projectId?, framework?, search?, sortBy?)
 *  - useGenerateReport()
 *  - useRegenerateReport()
 *  - useDeleteReport()
 *  - downloadReportPdf(reportId, projectId)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../lib/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ReportFinding {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  affected_documents: string[];
  evidence: string;
  supporting_controls: string[];
  framework_reference: string;
}

export interface ReportEvidence {
  document_name: string;
  page_number: number;
  section: string;
  paragraph: string;
  extract: string;
  confidence_score: number;
}

export interface ReportRecommendation {
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  evidence?: ReportEvidence;
  affected_controls: string[];
  affected_documents: string[];
  framework_reference: string;
  confidence: number;
}

export interface ReportCitation {
  document_name: string;
  page_number: number;
  control_id: string;
  framework: string;
  section: string;
  snippet: string;
}

export interface ReportDocumentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  confidence: number;
  framework: string;
  entities_count: number;
  node_count: number;
  file_size: string;
}

export interface ComplianceReportData {
  id: string;
  project_id: string;
  project_name: string;
  project_description: string;
  generated_at: string;
  generated_by: string;
  generated_role: string;
  
  detected_frameworks: string[];
  
  // Metrics
  total_documents: number;
  processed_documents: number;
  failed_documents: number;
  entities_count: number;
  relationships_count: number;
  neo4j_nodes: number;
  neo4j_relationships: number;
  qdrant_vector_count: number;
  embedding_model: string;
  avg_confidence: number;
  avg_retrieval_score: number;
  graph_density: number;
  avg_degree: number;
  avg_processing_time: string;
  
  // Breakdown
  entity_categories: Record<string, number>;
  entity_percentages: Record<string, number>;
  
  top_connected_nodes: Array<{ name: string; degree: number }>;
  most_referenced_controls: string[];
  most_referenced_policies: string[];
  top_risks: string[];
  relationship_types: Record<string, number>;
  
  // Scoring
  overall_compliance_score: number;
  framework_coverage_pct: number;
  control_coverage_pct: number;
  risk_score: number;
  critical_findings_count: number;
  high_findings_count: number;
  medium_findings_count: number;
  low_findings_count: number;
  scoring_methodology: string;
  
  // AI Content
  executive_summary: string;
  findings: ReportFinding[];
  recommendations: ReportRecommendation[];
  citations: ReportCitation[];
  documents: ReportDocumentSummary[];
  
  // Step 15 Validation
  validation_passed: boolean;
  validation_notes: string[];

  // File Paths
  file_path?: string;
  pdf_path?: string;
  pdf_url?: string;
  status?: string;
}

const REPORTS_QUERY_KEY = ['compliance_reports'] as const;

// ─── Fetch Reports ─────────────────────────────────────────────────────────────
export function useReports(
  projectId?: string,
  framework?: string,
  search?: string,
  sortBy: string = 'newest'
) {
  const query = useQuery({
    queryKey: [...REPORTS_QUERY_KEY, projectId, framework, search, sortBy],
    queryFn: async (): Promise<ComplianceReportData[]> => {
      try {
        const params = new URLSearchParams();
        if (projectId) params.append('project_id', projectId);
        if (framework) params.append('framework', framework);
        if (search) params.append('search', search);
        if (sortBy) params.append('sort_by', sortBy);

        const url = `/reports${params.toString() ? '?' + params.toString() : ''}`;
        const res = await apiClient.get<ApiResponse<ComplianceReportData[]>>(url);
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    enabled: true,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    reports: query.data ?? [],
  };
}

// ─── Generate New Compliance Report ───────────────────────────────────────────
export function useGenerateReport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<ComplianceReportData> => {
      const res = await apiClient.post<ApiResponse<ComplianceReportData>>('/reports/generate', {
        project_id: projectId,
      });
      if (!res.data?.success || !res.data?.data) {
        throw new Error(res.data?.message || 'Report generation failed');
      }
      return res.data.data;
    },
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...REPORTS_QUERY_KEY, projectId] });
    },
  });
}

// ─── Regenerate Existing Report ───────────────────────────────────────────────
export function useRegenerateReport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, projectId }: { reportId: string; projectId: string }): Promise<ComplianceReportData> => {
      const res = await apiClient.post<ApiResponse<ComplianceReportData>>(`/reports/${reportId}/regenerate?project_id=${encodeURIComponent(projectId)}`);
      if (!res.data?.success || !res.data?.data) {
        throw new Error(res.data?.message || 'Report regeneration failed');
      }
      return res.data.data;
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...REPORTS_QUERY_KEY, projectId] });
    },
  });
}

// ─── Delete Report ─────────────────────────────────────────────────────────────
export function useDeleteReport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, projectId }: { reportId: string; projectId: string }): Promise<boolean> => {
      const url = `/reports/${reportId}?project_id=${encodeURIComponent(projectId)}`;
      const res = await apiClient.delete<ApiResponse<any>>(url);
      return res.data?.success ?? false;
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...REPORTS_QUERY_KEY, projectId] });
    },
  });
}

// ─── Download PDF Helper ───────────────────────────────────────────────────────
export async function downloadReportPdf(reportId: string, projectId?: string): Promise<void> {
  try {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
    const url = `/reports/${reportId}/pdf${params.toString() ? '?' + params.toString() : ''}`;
    
    const res = await apiClient.get(url, { responseType: 'blob' });
    
    // Check if server returned a JSON error inside a blob
    if (res.data && res.data.type === 'application/json') {
      const text = await res.data.text();
      let msg = 'Server error';
      try {
        const parsed = JSON.parse(text);
        msg = parsed.detail || parsed.message || msg;
      } catch {
        msg = text;
      }
      throw new Error(msg);
    }

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Compliance_Audit_Report_${reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err: any) {
    console.error('PDF download error:', err);
    let errMsg = err?.message || String(err);
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        errMsg = parsed.detail || parsed.message || errMsg;
      } catch {
        // ignore parse error
      }
    }
    if (errMsg === 'Network Error' || !err?.response) {
      errMsg = 'Network Error: Unable to connect to backend server (http://localhost:8000). Please ensure the backend server is running.';
    }
    alert(`Failed to download PDF report: ${errMsg}`);
  }
}
