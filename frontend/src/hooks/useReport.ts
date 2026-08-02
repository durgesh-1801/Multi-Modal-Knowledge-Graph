/**
 * useReport — Aggregates live backend data for the Enterprise Audit Report.
 *
 * Data sources:
 *  - GET /graph/statistics     → Neo4j node/edge counts, type distributions
 *  - GET /documents            → Document list, entities, confidence scores
 *  - GET /embeddings/stats     → Qdrant live vector count
 *  - GET /settings             → LLM provider, embedding model info
 *  - POST /rag/query (×3)      → AI executive summary, findings, recommendations
 *  - AuthContext               → Current authenticated user + role
 */
import { useState, useCallback } from 'react';
import { apiClient, ApiResponse } from '../lib/api';
import { GraphStatistics, SystemSettingsData } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmbeddingStats {
  vector_count: number;
  collection_name: string;
  embedding_model: string;
  embedding_dimension: number;
  qdrant_connected: boolean;
}

export interface RagResult {
  answer: string;
  confidence: number;
  citations: Array<{ document: string; page: number; snippet: string; relevance: number; chunk_id: string }>;
  related_entities: string[];
}

export interface ReportDocument {
  id: string;
  name: string;
  type: string;
  confidence: number;
  framework: string;
  entities: string[];
  node_count: number;
  status: string;
}

export interface ReportData {
  generatedAt: string;
  // System overview
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  totalEntities: number;
  totalRelationships: number;
  neo4jNodes: number;
  neo4jRelationships: number;
  qdrantVectorCount: number;
  avgConfidence: number;
  graphDensity: number;
  avgDegree: number;
  // Entity type breakdown from Neo4j
  entityTypeDistribution: Record<string, number>;
  // Top entities from Neo4j
  topEntities: Array<{ name?: string; label?: string; degree?: number }>;
  // Relationship type distribution
  relationshipTypes: Record<string, number>;
  // Document list
  documents: ReportDocument[];
  // Detected frameworks (inferred from doc names + entity types)
  detectedFrameworks: string[];
  // AI-generated sections
  executiveSummary: string;
  aiFindings: Array<{ title: string; description: string; severity: 'critical' | 'high' | 'medium' | 'low'; evidence: string }>;
  recommendations: Array<{ title: string; priority: 'critical' | 'high' | 'medium' | 'low'; reason: string; citations: string[]; framework: string }>;
  // Stack info
  llmProvider: string;
  embeddingModel: string;
  // Validation
  validationPassed: boolean;
  validationNotes: string[];
}

// ─── Framework keyword detection ──────────────────────────────────────────────

const FRAMEWORK_KEYWORDS: Record<string, string[]> = {
  'HIPAA': ['hipaa', 'phi', 'protected health', 'patient', 'ehr', 'healthcare'],
  'GDPR': ['gdpr', 'data subject', 'pii', 'personal data', 'eu', 'european', 'dpo'],
  'PCI DSS': ['pci', 'dss', 'cardholder', 'payment card', 'credit card'],
  'SOC 2': ['soc2', 'soc 2', 'trust services', 'aicpa', 'availability', 'confidentiality'],
  'ISO 27001': ['iso27001', 'iso 27001', 'isms', 'information security management'],
  'NIST SP 800-53': ['nist 800-53', 'nist sp 800', 'sp800', 'access control', 'incident response'],
  'NIST CSF': ['nist csf', 'cybersecurity framework', 'identify protect detect respond recover'],
  'NIST SP 800-37': ['800-37', 'risk management framework', 'rmf'],
  'Zero Trust': ['zero trust', 'zerotrust', 'never trust', 'micro-segment', 'least privilege'],
  'FedRAMP': ['fedramp', 'federal risk', 'authorization management'],
  'CMMC': ['cmmc', 'cybersecurity maturity model', 'controlled unclassified'],
};

function detectFrameworks(documents: ReportDocument[], entityTypes: Record<string, number>): string[] {
  const detected = new Set<string>();
  const corpus = [
    ...documents.map(d => `${d.name} ${d.framework} ${d.entities.join(' ')}`),
    ...Object.keys(entityTypes),
  ].join(' ').toLowerCase();

  for (const [framework, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    if (keywords.some(kw => corpus.includes(kw))) {
      detected.add(framework);
    }
  }
  return Array.from(detected);
}

// ─── RAG query helper ─────────────────────────────────────────────────────────

async function runRagQuery(query: string): Promise<RagResult> {
  try {
    const res = await apiClient.post<ApiResponse<RagResult>>('/rag/query', {
      query,
      top_k: 10,
      session_id: 'audit_report',
    });
    return res.data?.data ?? { answer: '', confidence: 0, citations: [], related_entities: [] };
  } catch {
    return { answer: '', confidence: 0, citations: [], related_entities: [] };
  }
}

// ─── Parse AI findings from RAG answer ───────────────────────────────────────

function parseFindings(answer: string): ReportData['aiFindings'] {
  if (!answer) return [];
  const lines = answer.split('\n').filter(l => l.trim().length > 20);
  const severities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
  return lines.slice(0, 6).map((line, i) => {
    const clean = line.replace(/^[•\-\d\.\*]+\s*/, '').trim();
    const colonIdx = clean.indexOf(':');
    const title = colonIdx > 0 ? clean.slice(0, colonIdx).trim() : `Finding ${i + 1}`;
    const desc = colonIdx > 0 ? clean.slice(colonIdx + 1).trim() : clean;
    const sev = severities[i % severities.length];
    return { title, description: desc, severity: sev, evidence: desc };
  });
}

// ─── Parse recommendations from RAG answer ────────────────────────────────────

function parseRecommendations(
  answer: string,
  citations: RagResult['citations']
): ReportData['recommendations'] {
  if (!answer) return [];
  const lines = answer.split('\n').filter(l => l.trim().length > 20);
  const priorities: Array<'critical' | 'high' | 'medium' | 'low'> = ['high', 'high', 'medium', 'medium', 'low'];
  return lines.slice(0, 5).map((line, i) => {
    const clean = line.replace(/^[•\-\d\.\*]+\s*/, '').trim();
    const colonIdx = clean.indexOf(':');
    const title = colonIdx > 0 ? clean.slice(0, colonIdx).trim() : `Recommendation ${i + 1}`;
    const reason = colonIdx > 0 ? clean.slice(colonIdx + 1).trim() : clean;
    const cite = citations[i];
    const citationStr = cite ? `${cite.document}${cite.page > 1 ? ` (p.${cite.page})` : ''}: "${cite.snippet?.slice(0, 80)}..."` : '';
    const framework = cite?.document?.split('.')[0] ?? 'General';
    return {
      title,
      priority: priorities[i] ?? 'medium',
      reason,
      citations: citationStr ? [citationStr] : [],
      framework,
    };
  });
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useReport() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // ── 1. Fetch all data sources in parallel ─────────────────────────────
      const [graphRes, docsRes, vectorRes, settingsRes] = await Promise.allSettled([
        apiClient.get<ApiResponse<GraphStatistics>>('/graph/statistics'),
        apiClient.get<ApiResponse<ReportDocument[]>>('/documents'),
        apiClient.get<ApiResponse<EmbeddingStats>>('/embeddings/stats'),
        apiClient.get<ApiResponse<SystemSettingsData>>('/settings').catch(() => null),
      ]);

      // ── 2. Extract values safely ──────────────────────────────────────────
      const graphData = graphRes.status === 'fulfilled' ? graphRes.value.data?.data : null;
      const documents: ReportDocument[] = docsRes.status === 'fulfilled'
        ? (Array.isArray(docsRes.value.data?.data) ? docsRes.value.data.data : [])
        : [];
      const vectorData = vectorRes.status === 'fulfilled' ? vectorRes.value.data?.data : null;
      const settingsData = settingsRes?.status === 'fulfilled' && settingsRes.value
        ? (settingsRes.value as any)?.data?.data
        : null;

      const totalNodes = graphData?.node_count ?? graphData?.total_nodes ?? 0;
      const totalEdges = graphData?.relationship_count ?? graphData?.total_edges ?? 0;
      const entityTypes = graphData?.entity_types ?? graphData?.node_type_distribution ?? {};
      const topEntities = graphData?.most_connected_entities ?? [];
      const graphDensity = graphData?.graph_density ?? 0;
      const avgDegree = graphData?.average_degree ?? graphData?.avg_degree ?? 0;
      const totalDocs = documents.length;
      const processedDocs = documents.filter(d => d.status !== 'Processing').length;
      const failedDocs = documents.filter(d => d.status === 'Risk Flagged').length;
      const avgConf = totalDocs > 0
        ? Math.round(documents.reduce((s, d) => s + (d.confidence ?? 95), 0) / totalDocs)
        : 0;

      const detectedFrameworks = detectFrameworks(documents, entityTypes);

      // ── 3. Validation check ───────────────────────────────────────────────
      const validationNotes: string[] = [];
      if (totalDocs === 0) validationNotes.push('No documents found in the system.');
      if (totalNodes === 0) validationNotes.push('No entities found in Neo4j graph.');
      const validationPassed = validationNotes.length === 0;

      // ── 4. Fire RAG queries in parallel (single combined query for speed) ─
      const docNames = documents.map(d => d.name).slice(0, 10).join(', ');
      const frameworkList = detectedFrameworks.length > 0 ? detectedFrameworks.join(', ') : 'general compliance';
      const entityCount = totalNodes;
      const relCount = totalEdges;

      const [summaryResult, findingsResult, recsResult] = await Promise.all([
        runRagQuery(
          `Generate a concise executive compliance summary for an enterprise audit report. ` +
          `The system has processed ${totalDocs} documents including: ${docNames || 'uploaded compliance documents'}. ` +
          `Detected compliance frameworks: ${frameworkList}. ` +
          `Knowledge graph contains ${entityCount} entities and ${relCount} relationships. ` +
          `Identify the strongest and weakest coverage areas. Be specific and evidence-based.`
        ),
        runRagQuery(
          `Analyze the uploaded compliance documents and generate 5 specific security and compliance findings. ` +
          `Focus on: Access Control, Risk Management, Zero Trust, Cryptography, Incident Response, Vendor Risk. ` +
          `Format each finding as: "Finding Title: Detailed description with specific evidence." ` +
          `Only report findings supported by the uploaded document content. Do not use generic text.`
        ),
        runRagQuery(
          `Based on the uploaded compliance documents, generate 5 specific actionable recommendations. ` +
          `Each recommendation must reference the source document and cite a specific control, section, or requirement. ` +
          `Format as: "Recommendation Title: Detailed action with framework reference." ` +
          `Include citations to actual document content. No generic recommendations.`
        ),
      ]);

      // ── 5. Build final ReportData ────────────────────────────────────────
      const now = new Date();
      const report: ReportData = {
        generatedAt: now.toISOString(),
        totalDocuments: totalDocs,
        processedDocuments: processedDocs,
        failedDocuments: failedDocs,
        totalEntities: entityCount,
        totalRelationships: relCount,
        neo4jNodes: totalNodes,
        neo4jRelationships: totalEdges,
        qdrantVectorCount: vectorData?.vector_count ?? 0,
        avgConfidence: avgConf,
        graphDensity,
        avgDegree,
        entityTypeDistribution: entityTypes,
        topEntities,
        relationshipTypes: {},  // will be populated from graph edge types if available
        documents,
        detectedFrameworks,
        executiveSummary: summaryResult.answer || 'Executive summary generation requires uploaded documents.',
        aiFindings: parseFindings(findingsResult.answer),
        recommendations: parseRecommendations(recsResult.answer, recsResult.citations),
        llmProvider: settingsData?.llm_provider ?? 'Groq',
        embeddingModel: vectorData?.embedding_model ?? settingsData?.embedding_model ?? 'all-MiniLM-L6-v2',
        validationPassed,
        validationNotes,
      };

      setReportData(report);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate audit report. Check backend connectivity.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setReportData(null);
    setError(null);
  }, []);

  return { reportData, isGenerating, error, generate, reset };
}
