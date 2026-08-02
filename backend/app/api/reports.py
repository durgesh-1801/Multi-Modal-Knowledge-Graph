"""
Compliance Reports REST API Router.

Provides endpoints for generating, querying, viewing, downloading PDF, regenerating,
and deleting dynamic, backend-driven compliance audit reports per project.
All requests pass through the unified ReportGenerationService.
"""

from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.audit import record_audit_log
from app.core.config import settings
from app.core.logging import logger
from app.core.rbac import Permission
from app.core.security import get_current_user, require_permission
from app.schemas.common import StandardResponse
from app.schemas.rbac import UserResponse
from app.services.report_service import ComplianceReport, report_service

router = APIRouter()


class GenerateReportRequest(BaseModel):
    project_id: str = Field(..., description="Target project ID to generate report for")


@router.post(
    "/generate",
    response_model=StandardResponse[ComplianceReport],
    status_code=status.HTTP_201_CREATED,
    summary="Generate Live Compliance Report",
    description="Generates dynamic compliance audit report entirely from live backend Neo4j, Qdrant, and Graph RAG data.",
)
async def generate_compliance_report(
    payload: GenerateReportRequest,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_REPORTS)),
) -> StandardResponse[ComplianceReport]:
    """Generates dynamic compliance report for given project_id."""
    logger.info(f"Generating live compliance report for project '{payload.project_id}' by user '{current_user.email}'")

    if not payload.project_id or not payload.project_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID is required to generate a compliance report.",
        )

    try:
        report = await report_service.generate_report(
            project_id=payload.project_id.strip(),
            user_name=current_user.name or current_user.email,
            user_role=current_user.role,
            user_email=current_user.email,
        )

        record_audit_log(
            action="GENERATE_COMPLIANCE_REPORT",
            details=f"Generated report '{report.id}' for project '{payload.project_id}' with compliance score {report.overall_compliance_score}%.",
            user=current_user,
            request=request,
        )

        return StandardResponse[ComplianceReport](
            success=True,
            message="Compliance report generated successfully from live project data",
            data=report,
        )
    except ValueError as val_err:
        logger.warning(f"Backend validation failed for project '{payload.project_id}': {val_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as err:
        logger.error(f"Failed to generate compliance report: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(err)}",
        )


@router.get(
    "",
    response_model=StandardResponse[List[ComplianceReport]],
    status_code=status.HTTP_200_OK,
    summary="List Generated Compliance Reports",
    description="Returns all compliance reports generated, supporting filters and sorting.",
)
async def list_compliance_reports(
    project_id: Optional[str] = Query(None, description="Filter reports by project ID"),
    framework: Optional[str] = Query(None, description="Filter by compliance framework"),
    search: Optional[str] = Query(None, description="Search by project name"),
    sort_by: str = Query("newest", description="Sort order: newest, oldest, score"),
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_REPORTS)),
) -> StandardResponse[List[ComplianceReport]]:
    """Retrieves list of generated compliance reports from DB."""
    reports = report_service.list_reports(
        project_id=project_id,
        framework=framework,
        search=search,
        sort_by=sort_by,
    )

    return StandardResponse[List[ComplianceReport]](
        success=True,
        message=f"Retrieved {len(reports)} compliance reports",
        data=reports,
    )


@router.get(
    "/{report_id}",
    response_model=StandardResponse[ComplianceReport],
    status_code=status.HTTP_200_OK,
    summary="Get Detailed Compliance Report",
    description="Retrieves a single generated compliance report by report ID.",
)
async def get_compliance_report(
    report_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID"),
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_REPORTS)),
) -> StandardResponse[ComplianceReport]:
    """Retrieves single report by ID."""
    report = report_service.get_report_by_id(project_id=project_id, report_id=report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance report '{report_id}' not found.",
        )
    return StandardResponse[ComplianceReport](
        success=True,
        message="Compliance report retrieved successfully",
        data=report,
    )


@router.get(
    "/{report_id}/pdf",
    summary="Download Stored Report PDF",
    description="Downloads the exact stored PyMuPDF PDF report file from server storage.",
)
async def download_report_pdf(
    report_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID"),
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_REPORTS)),
):
    """Returns stored PDF file stream, generating on-the-fly if missing."""
    report = report_service.get_report_by_id(project_id=project_id, report_id=report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance report '{report_id}' not found.",
        )

    pdf_path = Path(report.pdf_path) if report.pdf_path else None
    if not pdf_path or not pdf_path.exists():
        for p_dir in (Path(settings.UPLOAD_DIRECTORY) / "reports").glob("*"):
            if p_dir.is_dir():
                target_pdf = p_dir / f"{report_id}.pdf"
                if target_pdf.exists():
                    pdf_path = target_pdf
                    break

    # Generate on the fly if missing
    if not pdf_path or not pdf_path.exists():
        proj_dir = Path(settings.UPLOAD_DIRECTORY) / "reports" / report.project_id
        proj_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = proj_dir / f"{report.id}.pdf"
        try:
            report_service.pdf_generator.generate_pdf(report.model_dump(), pdf_path)
            report.pdf_path = str(pdf_path)
            report_service.store.save_report(report)
        except Exception as err:
            logger.error(f"Failed to generate PDF on the fly for report '{report_id}': {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to render PDF document: {str(err)}",
            )

    filename = f"{report.project_name.replace(' ', '_')}_Audit_Report_{report.id}.pdf"
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.post(
    "/{report_id}/regenerate",
    response_model=StandardResponse[ComplianceReport],
    status_code=status.HTTP_200_OK,
    summary="Regenerate Compliance Report",
    description="Deletes current report and re-runs live generation pipeline.",
)
async def regenerate_compliance_report(
    report_id: str,
    project_id: str = Query(..., description="Target project ID"),
    request: Request = None,
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_REPORTS)),
) -> StandardResponse[ComplianceReport]:
    """Regenerates report."""
    try:
        report = await report_service.regenerate_report(
            project_id=project_id,
            report_id=report_id,
            user_name=current_user.name or current_user.email,
            user_role=current_user.role,
            user_email=current_user.email,
        )

        record_audit_log(
            action="REGENERATE_COMPLIANCE_REPORT",
            details=f"Regenerated compliance report '{report_id}' for project '{project_id}'.",
            user=current_user,
            request=request,
        )

        return StandardResponse[ComplianceReport](
            success=True,
            message="Compliance report regenerated successfully",
            data=report,
        )
    except Exception as err:
        logger.error(f"Error regenerating report '{report_id}': {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report regeneration failed: {str(err)}",
        )


@router.delete(
    "/{report_id}",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Delete Compliance Report",
    description="Deletes a generated compliance report metadata and PDF file.",
)
async def delete_compliance_report(
    report_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID"),
    request: Request = None,
    current_user: UserResponse = Depends(require_permission(Permission.DOWNLOAD_REPORTS)),
) -> StandardResponse[dict]:
    """Deletes report by ID."""
    success = report_service.delete_report(project_id, report_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_id}' not found or already deleted.",
        )

    record_audit_log(
        action="DELETE_COMPLIANCE_REPORT",
        details=f"Deleted compliance report '{report_id}'.",
        user=current_user,
        request=request,
    )

    return StandardResponse[dict](
        success=True,
        message=f"Compliance report '{report_id}' deleted successfully",
        data={"report_id": report_id},
    )
