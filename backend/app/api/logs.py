"""
Audit Logs REST API Router (Admin Only).

Provides view and filter access to system audit logs.
"""

from typing import List
from fastapi import APIRouter, Depends, Query, status

from app.core.rbac import Permission
from app.core.security import require_permission
from app.schemas.common import StandardResponse
from app.schemas.rbac import AuditLogResponse, UserResponse
from app.services.rbac_store import RBACStore

router = APIRouter()


@router.get(
    "",
    response_model=StandardResponse[List[AuditLogResponse]],
    status_code=status.HTTP_200_OK,
    summary="Get System Audit Logs",
)
async def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_LOGS)),
) -> StandardResponse[List[AuditLogResponse]]:
    """Retrieves enterprise system action audit logs. (Admin Only)"""
    store = RBACStore.get_instance()
    logs = store.get_audit_logs(limit=limit)
    return StandardResponse[List[AuditLogResponse]](
        success=True,
        message="Audit logs retrieved successfully",
        data=logs,
    )
