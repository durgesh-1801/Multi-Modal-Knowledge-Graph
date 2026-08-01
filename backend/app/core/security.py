"""
Authentication, JWT Management, and Role/Permission Authorization Dependencies.
"""

import base64
import json
import time
from typing import List, Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.logging import logger
from app.core.rbac import Permission, Role, has_permission
from app.schemas.rbac import UserResponse, UserStatus
from app.services.rbac_store import RBACStore, hash_password

# Secret key for token signature/decoding
JWT_SECRET_KEY = "enterprise_rbac_super_secret_jwt_key_2026"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 86400  # 24 Hours

security_scheme = HTTPBearer(auto_error=False)


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user: UserResponse, expires_in: int = JWT_EXPIRATION_SECONDS) -> str:
    """
    Generate signed JWT Access Token containing user_id, email, role, and expiration.
    Uses standard lightweight JWT format (header.payload.signature).
    """
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role.value,
        "iat": now,
        "exp": now + expires_in,
    }

    header_b64 = _base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(payload).encode('utf-8'))
    
    # Signature simulation over header + payload
    import hashlib
    signature_raw = f"{header_b64}.{payload_b64}.{JWT_SECRET_KEY}".encode('utf-8')
    signature = hashlib.sha256(signature_raw).hexdigest()

    return f"{header_b64}.{payload_b64}.{signature}"


def decode_access_token(token: str) -> dict:
    """
    Decode and validate signed JWT Access Token.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid HTTP Authorization token format.",
            )
        
        header_b64, payload_b64, signature = parts
        import hashlib
        expected_sig = hashlib.sha256(f"{header_b64}.{payload_b64}.{JWT_SECRET_KEY}".encode('utf-8')).hexdigest()
        
        if signature != expected_sig:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token signature.",
            )

        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))

        if payload.get("exp") and time.time() > payload["exp"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired.",
            )

        return payload
    except HTTPException:
        raise
    except Exception as err:
        logger.warning(f"JWT Token decode failed: {err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> UserResponse:
    """
    Dependency provider parsing JWT token from Authorization header or bearer token.
    Falls back to Admin context during unauthenticated dev/swagger testing if header omitted.
    """
    token: Optional[str] = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif "authorization" in request.headers:
        auth_header = request.headers["authorization"]
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    rbac_store = RBACStore.get_instance()

    if not token:
        # Check query params or fallback default user for swagger convenience
        if "test_user_role" in request.query_params:
            role_param = request.query_params["test_user_role"].upper()
            for u in rbac_store.get_all_users():
                if u.role.value == role_param:
                    return u

        # Fallback to Admin for direct local endpoint testing if no header is supplied
        admin_user = rbac_store.get_user_by_email("admin@enterprise.com")
        if admin_user:
            return UserResponse(**admin_user)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    
    user_dict = rbac_store.get_user_by_id(user_id)
    if not user_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found.",
        )

    if user_dict["status"] != UserStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account status is currently '{user_dict['status']}'. Access denied.",
        )

    return UserResponse(**user_dict)


def require_role(*allowed_roles: Role):
    """
    Dependency factory enforcing role membership. Raises HTTP 403 Forbidden if user lacks role.
    """
    async def role_checker(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if current_user.role not in allowed_roles:
            logger.warning(
                f"Forbidden access: User '{current_user.email}' with role '{current_user.role.value}' "
                f"attempted action requiring one of: {[r.value for r in allowed_roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Role '{current_user.role.value}' is not authorized. Requires one of {[r.value for r in allowed_roles]}.",
            )
        return current_user

    return role_checker


def require_permission(*required_permissions: Permission):
    """
    Dependency factory enforcing granular permissions. Raises HTTP 403 Forbidden if user's role lacks permission.
    """
    async def permission_checker(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
        for perm in required_permissions:
            if not has_permission(current_user.role, perm):
                logger.warning(
                    f"Forbidden access: User '{current_user.email}' with role '{current_user.role.value}' "
                    f"lacks permission '{perm.value}'"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access Denied: Role '{current_user.role.value}' lacks required permission '{perm.value}'.",
                )
        return current_user

    return permission_checker
