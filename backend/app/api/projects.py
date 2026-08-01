"""
Project Management REST API Router.

Provides creation, update, deletion, and user assignment for projects.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.audit import record_audit_log
from app.core.rbac import Permission
from app.core.security import get_current_user, require_permission
from app.schemas.common import StandardResponse
from app.schemas.rbac import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    UserResponse,
)
from app.services.rbac_store import RBACStore

router = APIRouter()


@router.get(
    "",
    response_model=StandardResponse[List[ProjectResponse]],
    status_code=status.HTTP_200_OK,
    summary="List System Projects",
)
async def list_projects(
    current_user: UserResponse = Depends(get_current_user),
) -> StandardResponse[List[ProjectResponse]]:
    """Retrieves list of projects."""
    store = RBACStore.get_instance()
    projects = store.get_all_projects()
    return StandardResponse[List[ProjectResponse]](
        success=True,
        message="Projects retrieved successfully",
        data=projects,
    )


@router.post(
    "",
    response_model=StandardResponse[ProjectResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create New Project",
)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.CREATE_PROJECT)),
) -> StandardResponse[ProjectResponse]:
    """Creates a new enterprise compliance project. (Admin Only)"""
    store = RBACStore.get_instance()
    new_project = store.create_project(payload, owner_id=current_user.id)
    
    record_audit_log(
        action="CREATE_PROJECT",
        details=f"User '{current_user.email}' created project '{new_project.name}' (ID: {new_project.id}).",
        user=current_user,
        request=request,
    )
    
    return StandardResponse[ProjectResponse](
        success=True,
        message="Project created successfully",
        data=new_project,
    )


@router.put(
    "/{project_id}",
    response_model=StandardResponse[ProjectResponse],
    status_code=status.HTTP_200_OK,
    summary="Update Project Details and Assign Members",
)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.CREATE_PROJECT)),
) -> StandardResponse[ProjectResponse]:
    """Updates project information and assigns team members. (Admin Only)"""
    store = RBACStore.get_instance()
    try:
        updated = store.update_project(project_id, payload)
        record_audit_log(
            action="UPDATE_PROJECT",
            details=f"User '{current_user.email}' updated project '{updated.name}'.",
            user=current_user,
            request=request,
        )
        return StandardResponse[ProjectResponse](
            success=True,
            message="Project updated successfully",
            data=updated,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )


@router.delete(
    "/{project_id}",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Delete Project",
)
async def delete_project(
    project_id: str,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.DELETE_PROJECT)),
) -> StandardResponse[dict]:
    """Deletes an existing project. (Admin Only)"""
    store = RBACStore.get_instance()
    proj = store.get_project_by_id(project_id)
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )

    deleted = store.delete_project(project_id)
    if deleted:
        record_audit_log(
            action="DELETE_PROJECT",
            details=f"User '{current_user.email}' deleted project '{proj.name}' (ID: {project_id}).",
            user=current_user,
            request=request,
        )
        return StandardResponse[dict](
            success=True,
            message="Project deleted successfully",
            data={"project_id": project_id},
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to delete project.",
    )
