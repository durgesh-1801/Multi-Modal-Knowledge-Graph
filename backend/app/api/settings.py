"""
System Settings REST API Router (Admin Only).

Provides management endpoints for global AI models, Graph DB, Vector DB, and Security options.
"""

from fastapi import APIRouter, Depends, Request, status

from app.core.audit import record_audit_log
from app.core.rbac import Permission
from app.core.security import require_permission
from app.schemas.common import StandardResponse
from app.schemas.rbac import SystemSettings, UserResponse
from app.services.rbac_store import RBACStore

router = APIRouter()


@router.get(
    "",
    response_model=StandardResponse[SystemSettings],
    status_code=status.HTTP_200_OK,
    summary="Get System Settings",
)
async def get_settings(
    current_user: UserResponse = Depends(require_permission(Permission.MANAGE_SETTINGS)),
) -> StandardResponse[SystemSettings]:
    """Retrieves current platform system settings. (Admin Only)"""
    store = RBACStore.get_instance()
    settings_obj = store.get_settings()
    return StandardResponse[SystemSettings](
        success=True,
        message="System settings retrieved successfully",
        data=settings_obj,
    )


@router.post(
    "",
    response_model=StandardResponse[SystemSettings],
    status_code=status.HTTP_200_OK,
    summary="Update System Settings",
)
async def update_settings(
    payload: SystemSettings,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.MANAGE_SETTINGS)),
) -> StandardResponse[SystemSettings]:
    """Updates platform configuration settings. (Admin Only)"""
    store = RBACStore.get_instance()
    updated = store.update_settings(payload)
    
    record_audit_log(
        action="UPDATE_SYSTEM_SETTINGS",
        details=f"Admin '{current_user.email}' updated system settings (LLM: {payload.llm_provider}, Theme: {payload.theme}).",
        user=current_user,
        request=request,
    )

    return StandardResponse[SystemSettings](
        success=True,
        message="System settings updated successfully",
        data=updated,
    )
