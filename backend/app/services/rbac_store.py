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
            "frameworks": ["HIPAA", "GDPR", "ISO 27001"],
            "owner": "Sarah Jenkins (admin@enterprise.com)",
            "members": [
                {"id": "mem_01", "user_id": "usr_admin_001", "name": "Sarah Jenkins", "email": "admin@enterprise.com", "role": "Admin"},
                {"id": "mem_02", "user_id": "usr_officer_002", "name": "David Ross", "email": "officer@enterprise.com", "role": "Compliance Officer"},
                {"id": "mem_03", "user_id": "usr_auditor_003", "name": "Elena Rostova", "email": "auditor@enterprise.com", "role": "Auditor"},
            ],
            "roles": ["Admin", "Compliance Officer", "Auditor"],
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
    def _format_project(self, p: dict) -> ProjectResponse:
        members_data = p.get("members", [])
        formatted_members = []
        roles_set = set()
        for m in members_data:
            mem_id = m.get("id") or f"mem_{uuid.uuid4().hex[:6]}"
            mem_name = m.get("name") or m.get("user_name") or "Team Member"
            mem_email = m.get("email") or m.get("user_email") or ""
            mem_role = m.get("role") or "Viewer"
            roles_set.add(mem_role)
            formatted_members.append(
                ProjectMember(
                    id=mem_id,
                    user_id=m.get("user_id"),
                    name=mem_name,
                    email=mem_email,
                    role=mem_role,
                )
            )

        return ProjectResponse(
            id=p["id"],
            name=p["name"],
            description=p.get("description", ""),
            frameworks=p.get("frameworks", []),
            owner=p.get("owner") or "Sarah Jenkins (Admin)",
            members=formatted_members,
            roles=sorted(list(roles_set)),
            created_at=p.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=p.get("updated_at", datetime.now(timezone.utc).isoformat()),
        )

    def get_all_projects(self) -> List[ProjectResponse]:
        with self._lock:
            return [self._format_project(p) for p in self._projects.values()]

    def get_project_by_id(self, project_id: str) -> Optional[ProjectResponse]:
        with self._lock:
            p = self._projects.get(project_id)
            return self._format_project(p) if p else None

    def create_project(self, payload: ProjectCreate, owner_id: str) -> ProjectResponse:
        with self._lock:
            # 1. Validation: Project Name required
            if not payload.name or not payload.name.strip():
                raise ValueError("Project Name is required.")

            # 2. Validation: Team Members required
            members_raw = [m.model_dump() for m in (payload.members or [])]
            if not members_raw:
                raise ValueError("At least one team member is required.")

            # 3. Validation: Duplicate email check
            emails = [m["email"].strip().lower() for m in members_raw if m.get("email")]
            if len(emails) != len(set(emails)):
                raise ValueError("Duplicate member emails are not allowed within a project.")

            # 4. Validation: Owner / Admin role check
            has_admin = any(m.get("role", "").lower() == "admin" for m in members_raw)
            if not has_admin:
                raise ValueError("Project must contain at least one member with the 'Admin' role.")

            # Format members with IDs
            processed_members = []
            for m in members_raw:
                processed_members.append({
                    "id": m.get("id") or f"mem_{uuid.uuid4().hex[:6]}",
                    "user_id": m.get("user_id"),
                    "name": m.get("name", "Team Member"),
                    "email": m.get("email", ""),
                    "role": m.get("role", "Viewer"),
                })

            owner_member = next((m for m in processed_members if m["role"].lower() == "admin"), processed_members[0])
            owner_info = f"{owner_member['name']} ({owner_member['email']})"

            project_id = f"proj_{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc).isoformat()

            proj_dict = {
                "id": project_id,
                "name": payload.name.strip(),
                "description": payload.description or "",
                "frameworks": payload.frameworks or [],
                "owner": payload.owner or owner_info,
                "members": processed_members,
                "created_at": now,
                "updated_at": now,
            }

            self._projects[project_id] = proj_dict
            return self._format_project(proj_dict)

    def update_project(self, project_id: str, payload: ProjectUpdate) -> ProjectResponse:
        with self._lock:
            if project_id not in self._projects:
                raise KeyError(f"Project '{project_id}' not found.")
            p = self._projects[project_id]

            if payload.name is not None:
                if not payload.name.strip():
                    raise ValueError("Project Name cannot be empty.")
                p["name"] = payload.name.strip()
            if payload.description is not None:
                p["description"] = payload.description
            if payload.frameworks is not None:
                p["frameworks"] = payload.frameworks
            if payload.owner is not None:
                p["owner"] = payload.owner
            if payload.members is not None:
                members_raw = [m.model_dump() for m in payload.members]
                if not members_raw:
                    raise ValueError("At least one team member is required.")
                emails = [m["email"].strip().lower() for m in members_raw if m.get("email")]
                if len(emails) != len(set(emails)):
                    raise ValueError("Duplicate member emails are not allowed within a project.")
                has_admin = any(m.get("role", "").lower() == "admin" for m in members_raw)
                if not has_admin:
                    raise ValueError("Project must contain at least one member with the 'Admin' role.")
                
                p["members"] = [
                    {
                        "id": m.get("id") or f"mem_{uuid.uuid4().hex[:6]}",
                        "user_id": m.get("user_id"),
                        "name": m.get("name", "Team Member"),
                        "email": m.get("email", ""),
                        "role": m.get("role", "Viewer"),
                    }
                    for m in members_raw
                ]

            p["updated_at"] = datetime.now(timezone.utc).isoformat()
            return self._format_project(p)

    def delete_project(self, project_id: str) -> bool:
        with self._lock:
            if project_id in self._projects:
                del self._projects[project_id]
                return True
            return False

    def add_project_member(self, project_id: str, member: ProjectMemberCreate) -> ProjectResponse:
        with self._lock:
            if project_id not in self._projects:
                raise KeyError(f"Project '{project_id}' not found.")
            p = self._projects[project_id]
            members = p.get("members", [])

            # Check duplicate email
            if any(m.get("email", "").strip().lower() == member.email.strip().lower() for m in members):
                raise ValueError(f"Member with email '{member.email}' already exists in this project.")

            new_mem = {
                "id": f"mem_{uuid.uuid4().hex[:6]}",
                "name": member.name.strip(),
                "email": member.email.strip(),
                "role": member.role,
            }
            members.append(new_mem)
            p["members"] = members
            p["updated_at"] = datetime.now(timezone.utc).isoformat()
            return self._format_project(p)

    def remove_project_member(self, project_id: str, member_id: str) -> ProjectResponse:
        with self._lock:
            if project_id not in self._projects:
                raise KeyError(f"Project '{project_id}' not found.")
            p = self._projects[project_id]
            members = p.get("members", [])

            if len(members) <= 1:
                raise ValueError("Cannot remove member. A project must contain at least one member.")

            # Filter out member
            updated_members = [m for m in members if m.get("id") != member_id and m.get("email") != member_id]
            
            # Ensure Admin role remains
            has_admin = any(m.get("role", "").lower() == "admin" for m in updated_members)
            if not has_admin:
                raise ValueError("Cannot remove member. Project must contain at least one Admin member.")

            p["members"] = updated_members
            p["updated_at"] = datetime.now(timezone.utc).isoformat()
            return self._format_project(p)

    def update_project_member(self, project_id: str, member_id: str, new_role: str) -> ProjectResponse:
        with self._lock:
            if project_id not in self._projects:
                raise KeyError(f"Project '{project_id}' not found.")
            p = self._projects[project_id]
            members = p.get("members", [])

            found = False
            for m in members:
                if m.get("id") == member_id or m.get("email") == member_id:
                    m["role"] = new_role
                    found = True
                    break

            if not found:
                raise KeyError(f"Member '{member_id}' not found in project.")

            # Ensure at least one Admin remains
            has_admin = any(m.get("role", "").lower() == "admin" for m in members)
            if not has_admin:
                raise ValueError("Project must contain at least one Admin member.")

            p["members"] = members
            p["updated_at"] = datetime.now(timezone.utc).isoformat()
            return self._format_project(p)

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
