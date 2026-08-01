"""
User Management REST API Router (Admin Only).

Provides CRUD operations, role assignments, and status updates for system users.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.audit import record_audit_log
from app.core.rbac import Permission, Role
from app.core.security import require_permission
from app.schemas.common import StandardResponse
from app.schemas.rbac import (
    UserCreate,
    UserResponse,
    UserRoleUpdate,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.rbac_store import RBACStore

router = APIRouter()


@router.get(
    "",
    response_model=StandardResponse[List[UserResponse]],
    status_code=status.HTTP_200_OK,
    summary="List All Registered System Users",
)
async def list_users(
    current_user: UserResponse = Depends(require_permission(Permission.MANAGE_USERS)),
) -> StandardResponse[List[UserResponse]]:
    """Retrieves all registered system users. (Admin Only)"""
    store = RBACStore.get_instance()
    users = store.get_all_users()
    return StandardResponse[List[UserResponse]](
        success=True,
        message="Users list retrieved successfully",
        data=users,
    )


@router.post(
    "",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create / Invite New User",
)
async def create_user(
    payload: UserCreate,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.INVITE_USERS)),
) -> StandardResponse[UserResponse]:
    """Creates/invites a new user account with assigned role. (Admin Only)"""
    store = RBACStore.get_instance()
    try:
        new_user = store.create_user(payload)
        record_audit_log(
            action="CREATE_USER",
            details=f"Admin '{current_user.email}' created user '{new_user.email}' with role '{new_user.role.value}'.",
            user=current_user,
            request=request,
        )
        return StandardResponse[UserResponse](
            success=True,
            message="User created successfully",
            data=new_user,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.put(
    "/{user_id}",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Update User Account Profile",
)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.MANAGE_USERS)),
) -> StandardResponse[UserResponse]:
    """Updates user profile attributes (name, email). (Admin Only)"""
    store = RBACStore.get_instance()
    try:
        updated = store.update_user(user_id, name=payload.name, email=payload.email)
        record_audit_log(
            action="UPDATE_USER",
            details=f"Admin '{current_user.email}' updated profile for user '{updated.email}'.",
            user=current_user,
            request=request,
        )
        return StandardResponse[UserResponse](
            success=True,
            message="User updated successfully",
            data=updated,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )


@router.patch(
    "/{user_id}/role",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Change User Role Assignment",
)
async def change_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.CHANGE_USER_ROLE)),
) -> StandardResponse[UserResponse]:
    """Updates assigned RBAC role for a specific user. (Admin Only)"""
    store = RBACStore.get_instance()
    try:
        updated = store.update_user_role(user_id, payload.role)
        record_audit_log(
            action="CHANGE_USER_ROLE",
            details=f"Admin '{current_user.email}' updated role for user '{updated.email}' to '{payload.role.value}'.",
            user=current_user,
            request=request,
        )
        return StandardResponse[UserResponse](
            success=True,
            message=f"User role updated to '{payload.role.value}' successfully",
            data=updated,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )


@router.patch(
    "/{user_id}/status",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Change User Account Status",
)
async def change_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.CHANGE_USER_STATUS)),
) -> StandardResponse[UserResponse]:
    """Toggles status (ACTIVE, INACTIVE, SUSPENDED) for a user. (Admin Only)"""
    store = RBACStore.get_instance()
    try:
        updated = store.update_user_status(user_id, payload.status)
        record_audit_log(
            action="CHANGE_USER_STATUS",
            details=f"Admin '{current_user.email}' updated status for user '{updated.email}' to '{payload.status.value}'.",
            user=current_user,
            request=request,
        )
        return StandardResponse[UserResponse](
            success=True,
            message=f"User status updated to '{payload.status.value}' successfully",
            data=updated,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )


@router.delete(
    "/{user_id}",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Delete User Account",
)
async def delete_user(
    user_id: str,
    request: Request,
    current_user: UserResponse = Depends(require_permission(Permission.MANAGE_USERS)),
) -> StandardResponse[dict]:
    """Deletes a user account. (Admin Only)"""
    store = RBACStore.get_instance()
    user_target = store.get_user_by_id(user_id)
    if not user_target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )

    deleted = store.delete_user(user_id)
    if deleted:
        record_audit_log(
            action="DELETE_USER",
            details=f"Admin '{current_user.email}' deleted user '{user_target['email']}' (ID: {user_id}).",
            user=current_user,
            request=request,
        )
        return StandardResponse[dict](
            success=True,
            message="User account deleted successfully",
            data={"user_id": user_id},
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to delete user account.",
    )
