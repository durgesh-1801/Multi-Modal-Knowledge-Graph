"""
Enterprise Compliance Report Engine Service.

Delegates report generation and metadata storage directly to the unified
ReportGenerationService (`report_service.py`) to ensure a single source of truth.
"""

from app.services.report_service import (
    ComplianceReport,
    DocumentSummary,
    ReportCitation,
    ReportEvidence,
    ReportFinding,
    ReportGenerationService,
    ReportPostgresStore as ReportStore,
    ReportRecommendation,
    report_service,
)

# Backwards compatible alias
ComplianceReportEngine = ReportGenerationService

__all__ = [
    "ComplianceReport",
    "ReportFinding",
    "ReportEvidence",
    "ReportRecommendation",
    "ReportCitation",
    "DocumentSummary",
    "ReportStore",
    "ComplianceReportEngine",
    "report_service",
]
