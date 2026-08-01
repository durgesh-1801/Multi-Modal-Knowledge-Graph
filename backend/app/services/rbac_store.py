"""
In-Memory Thread-Safe Data Store for Users, Projects, System Settings, and Audit Logs.

Pre-seeds default enterprise accounts:
1. Admin: admin@enterprise.com
2. Compliance Officer: officer@enterprise.com
3. Auditor: auditor@enterprise.com
"""

import hashlib
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, List, Optional

from app.core.rbac import Role
from app.schemas.rbac import (
    AuditLogResponse,
    ProjectCreate,
    ProjectMember,
    ProjectResponse,
    ProjectUpdate,
    SystemSettings,
    UserCreate,
    UserResponse,
    UserStatus,
)


def hash_password(password: str) -> str:
    """Helper SHA256 password hasher with constant salt for standard verification."""
    salt = "enterprise_rbac_salt_2026"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()


class RBACStore:
    _instance = None
    _lock = Lock()

    def __init__(self):
        self._users: Dict[str, dict] = {}
        self._projects: Dict[str, dict] = {}
        self._audit_logs: List[dict] = []
        self._settings: dict = SystemSettings().model_dump()

        # Seed initial enterprise roles & accounts
        self._seed_initial_data()

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _seed_initial_data(self):
        """Seed default admin, compliance officer, auditor accounts and demo project."""
        now = datetime.now(timezone.utc).isoformat()

        initial_users = [
            {
                "id": "usr_admin_001",
                "email": "admin@enterprise.com",
                "name": "Sarah Jenkins (Admin)",
                "role": Role.ADMIN.value,
                "status": UserStatus.ACTIVE.value,
                "password_hash": hash_password("admin123"),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "usr_officer_002",
                "email": "officer@enterprise.com",
                "name": "David Ross (Compliance Officer)",
                "role": Role.COMPLIANCE_OFFICER.value,
                "status": UserStatus.ACTIVE.value,
                "password_hash": hash_password("officer123"),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "usr_auditor_003",
                "email": "auditor@enterprise.com",
                "name": "Elena Rostova (Auditor)",
                "role": Role.AUDITOR.value,
                "status": UserStatus.ACTIVE.value,
                "password_hash": hash_password("auditor123"),
                "created_at": now,
                "updated_at": now,
            },
        ]

        for u in initial_users:
            self._users[u["id"]] = u

        # Seed default enterprise compliance project
        demo_project_id = "proj_compliance_2026"
        self._projects[demo_project_id] = {
            "id": demo_project_id,
            "name": "HIPAA & GDPR Compliance Automation",
            "description": "Multi-modal Knowledge Graph automated auditing & compliance engine.",
            "owner_id": "usr_admin_001",
            "members": [
                {"user_id": "usr_admin_001", "user_name": "Sarah Jenkins", "user_email": "admin@enterprise.com", "role": Role.ADMIN.value},
                {"user_id": "usr_officer_002", "user_name": "David Ross", "user_email": "officer@enterprise.com", "role": Role.COMPLIANCE_OFFICER.value},
                {"user_id": "usr_auditor_003", "user_name": "Elena Rostova", "user_email": "auditor@enterprise.com", "role": Role.AUDITOR.value},
            ],
            "created_at": now,
            "updated_at": now,
        }

        # Seed initial system audit logs
        self._audit_logs.append({
            "id": f"log_{uuid.uuid4().hex[:8]}",
            "user_id": "usr_admin_001",
            "user_email": "admin@enterprise.com",
            "role": Role.ADMIN.value,
            "action": "SYSTEM_INITIALIZATION",
            "timestamp": now,
            "ip_address": "127.0.0.1",
            "details": "Enterprise RBAC System Initialized with default roles & initial users.",
        })

    # -------------------------------------------------------------------------
    # USER OPERATIONS
    # -------------------------------------------------------------------------
    def get_all_users(self) -> List[UserResponse]:
        with self._lock:
            return [UserResponse(**u) for u in self._users.values()]

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        with self._lock:
            return self._users.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[dict]:
        with self._lock:
            for u in self._users.values():
                if u["email"].lower() == email.lower():
                    return u
            return None

    def create_user(self, payload: UserCreate) -> UserResponse:
        with self._lock:
            for u in self._users.values():
                if u["email"].lower() == payload.email.lower():
                    raise ValueError(f"User with email '{payload.email}' already exists.")

            user_id = f"usr_{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc).isoformat()
            user_dict = {
                "id": user_id,
                "email": payload.email,
                "name": payload.name,
                "role": payload.role.value,
                "status": UserStatus.ACTIVE.value,
                "password_hash": hash_password(payload.password),
                "created_at": now,
                "updated_at": now,
            }
            self._users[user_id] = user_dict
            return UserResponse(**user_dict)

    def update_user(self, user_id: str, name: Optional[str] = None, email: Optional[str] = None) -> UserResponse:
        with self._lock:
            if user_id not in self._users:
                raise KeyError(f"User '{user_id}' not found.")
            user = self._users[user_id]
            if name:
                user["name"] = name
            if email:
                user["email"] = email
            user["updated_at"] = datetime.now(timezone.utc).isoformat()
            return UserResponse(**user)

    def update_user_role(self, user_id: str, new_role: Role) -> UserResponse:
        with self._lock:
            if user_id not in self._users:
                raise KeyError(f"User '{user_id}' not found.")
            user = self._users[user_id]
            user["role"] = new_role.value
            user["updated_at"] = datetime.now(timezone.utc).isoformat()
            return UserResponse(**user)

    def update_user_status(self, user_id: str, new_status: UserStatus) -> UserResponse:
        with self._lock:
            if user_id not in self._users:
                raise KeyError(f"User '{user_id}' not found.")
            user = self._users[user_id]
            user["status"] = new_status.value
            user["updated_at"] = datetime.now(timezone.utc).isoformat()
            return UserResponse(**user)

    def delete_user(self, user_id: str) -> bool:
        with self._lock:
            if user_id in self._users:
                del self._users[user_id]
                return True
            return False

    # -------------------------------------------------------------------------
    # PROJECT OPERATIONS
    # -------------------------------------------------------------------------
    def get_all_projects(self) -> List[ProjectResponse]:
        with self._lock:
            return [ProjectResponse(**p) for p in self._projects.values()]

    def get_project_by_id(self, project_id: str) -> Optional[ProjectResponse]:
        with self._lock:
            p = self._projects.get(project_id)
            return ProjectResponse(**p) if p else None

    def create_project(self, payload: ProjectCreate, owner_id: str) -> ProjectResponse:
        with self._lock:
            project_id = f"proj_{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc).isoformat()
            members_list = [m.model_dump() for m in (payload.members or [])]
            
            # Ensure owner is in members list
            owner_user = self._users.get(owner_id)
            if owner_user and not any(m["user_id"] == owner_id for m in members_list):
                members_list.append({
                    "user_id": owner_id,
                    "user_name": owner_user["name"],
                    "user_email": owner_user["email"],
                    "role": owner_user["role"],
                })

            proj_dict = {
                "id": project_id,
                "name": payload.name,
                "description": payload.description or "",
                "owner_id": owner_id,
                "members": members_list,
                "created_at": now,
                "updated_at": now,
            }
            self._projects[project_id] = proj_dict
            return ProjectResponse(**proj_dict)

    def update_project(self, project_id: str, payload: ProjectUpdate) -> ProjectResponse:
        with self._lock:
            if project_id not in self._projects:
                raise KeyError(f"Project '{project_id}' not found.")
            p = self._projects[project_id]
            if payload.name is not None:
                p["name"] = payload.name
            if payload.description is not None:
                p["description"] = payload.description
            if payload.members is not None:
                p["members"] = [m.model_dump() for m in payload.members]
            p["updated_at"] = datetime.now(timezone.utc).isoformat()
            return ProjectResponse(**p)

    def delete_project(self, project_id: str) -> bool:
        with self._lock:
            if project_id in self._projects:
                del self._projects[project_id]
                return True
            return False

    # -------------------------------------------------------------------------
    # SETTINGS & AUDIT LOGS
    # -------------------------------------------------------------------------
    def get_settings(self) -> SystemSettings:
        with self._lock:
            return SystemSettings(**self._settings)

    def update_settings(self, new_settings: SystemSettings) -> SystemSettings:
        with self._lock:
            self._settings = new_settings.model_dump()
            return SystemSettings(**self._settings)

    def add_audit_log(
        self,
        user_id: str,
        user_email: str,
        role: str,
        action: str,
        ip_address: str,
        details: str,
    ) -> AuditLogResponse:
        with self._lock:
            log_entry = {
                "id": f"log_{uuid.uuid4().hex[:8]}",
                "user_id": user_id,
                "user_email": user_email,
                "role": role,
                "action": action,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "ip_address": ip_address or "127.0.0.1",
                "details": details,
            }
            self._audit_logs.insert(0, log_entry)  # Most recent first
            return AuditLogResponse(**log_entry)

    def get_audit_logs(self, limit: int = 100) -> List[AuditLogResponse]:
        with self._lock:
            return [AuditLogResponse(**log) for log in self._audit_logs[:limit]]
