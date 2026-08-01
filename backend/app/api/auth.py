"""
Authentication API Router.

Provides JWT Login, Registration, and User Profile endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.audit import record_audit_log
from app.core.rbac import Permission, Role
from app.core.security import create_access_token, get_current_user, hash_password
from app.schemas.common import StandardResponse
from app.schemas.rbac import LoginRequest, TokenResponse, UserCreate, UserProfileResponse, UserResponse
from app.services.rbac_store import RBACStore

router = APIRouter()


@router.post(
    "/login",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Authenticate User & Issue JWT Token",
)
async def login(
    payload: LoginRequest,
    request: Request,
) -> StandardResponse[TokenResponse]:
    """Authenticates credentials against the enterprise directory and returns a signed JWT access token."""
    store = RBACStore.get_instance()
    user_dict = store.get_user_by_email(payload.email)

    if not user_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    hashed_input = hash_password(payload.password)
    if user_dict["password_hash"] != hashed_input:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = UserResponse(**user_dict)
    token = create_access_token(user)

    record_audit_log(
        action="USER_LOGIN",
        details=f"User '{user.email}' logged in successfully with role '{user.role.value}'.",
        user=user,
        request=request,
    )

    token_res = TokenResponse(
        access_token=token,
        user=user,
    )

    return StandardResponse[TokenResponse](
        success=True,
        message="Authentication successful",
        data=token_res,
    )


@router.post(
    "/register",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register New System User",
)
async def register(
    payload: UserCreate,
    request: Request,
) -> StandardResponse[UserResponse]:
    """Registers a new user account."""
    store = RBACStore.get_instance()
    try:
        new_user = store.create_user(payload)
        record_audit_log(
            action="USER_REGISTRATION",
            details=f"New user '{new_user.email}' registered with role '{new_user.role.value}'.",
            user=new_user,
            request=request,
        )
        return StandardResponse[UserResponse](
            success=True,
            message="User account registered successfully",
            data=new_user,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/me",
    response_model=StandardResponse[UserProfileResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile & Granted Permissions",
)
async def get_my_profile(
    current_user: UserResponse = Depends(get_current_user),
) -> StandardResponse[UserProfileResponse]:
    """Returns the authenticated user profile along with all active granted permissions."""
    from app.core.rbac import ROLE_PERMISSIONS
    
    granted = list(ROLE_PERMISSIONS.get(current_user.role, set()))
    profile = UserProfileResponse(
        user=current_user,
        permissions=granted,
    )

    return StandardResponse[UserProfileResponse](
        success=True,
        message="User profile retrieved successfully",
        data=profile,
    )
