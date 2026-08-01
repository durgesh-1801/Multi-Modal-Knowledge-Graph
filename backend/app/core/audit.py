"""
Audit Logging Helper Module.
Tracks and records user actions into the system RBAC store.
"""

from typing import Optional
from fastapi import Request

from app.core.logging import logger
from app.schemas.rbac import UserResponse
from app.services.rbac_store import RBACStore


def record_audit_log(
    action: str,
    details: str,
    user: Optional[UserResponse] = None,
    request: Optional[Request] = None,
):
    """
    Log an enterprise audit entry into the persistent RBAC store.
    """
    rbac_store = RBACStore.get_instance()
    
    user_id = user.id if user else "system"
    user_email = user.email if user else "system@enterprise.com"
    role = user.role.value if user else "SYSTEM"
    
    client_ip = "127.0.0.1"
    if request:
        if request.client:
            client_ip = request.client.host
        if "x-forwarded-for" in request.headers:
            client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()

    logger.info(f"AUDIT LOG [{action}] user='{user_email}' role='{role}' ip='{client_ip}' :: {details}")
    return rbac_store.add_audit_log(
        user_id=user_id,
        user_email=user_email,
        role=role,
        action=action,
        ip_address=client_ip,
        details=details,
    )
