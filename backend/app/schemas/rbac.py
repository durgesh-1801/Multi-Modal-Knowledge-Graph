"""
Pydantic Schemas for RBAC User Management, Projects, Auth, Audit Logs, and Settings.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.core.rbac import Permission, Role


class UserStatus(str, Enum):
    """User account operational status."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


# -----------------------------------------------------------------------------
# User Management Schemas
# -----------------------------------------------------------------------------
class UserBase(BaseModel):
    email: str = Field(..., description="Unique user email address.")
    name: str = Field(..., min_length=2, description="Full user display name.")
    role: Role = Field(default=Role.COMPLIANCE_OFFICER, description="Assigned RBAC role.")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Initial account password.")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, description="Updated display name.")
    email: Optional[str] = Field(None, description="Updated email address.")


class UserRoleUpdate(BaseModel):
    role: Role = Field(..., description="Target role assignment.")


class UserStatusUpdate(BaseModel):
    status: UserStatus = Field(..., description="Target user status.")


class UserResponse(UserBase):
    id: str = Field(..., description="Unique user identifier.")
    status: UserStatus = Field(..., description="Current account status.")
    created_at: str = Field(..., description="Account creation ISO timestamp.")
    updated_at: str = Field(..., description="Account last updated ISO timestamp.")

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Project Management Schemas
# -----------------------------------------------------------------------------
class ProjectMember(BaseModel):
    id: Optional[str] = Field(None, description="Unique member identifier.")
    user_id: Optional[str] = Field(None, description="Target user ID if linked.")
    name: str = Field(..., description="Full member display name.")
    email: str = Field(..., description="Member email address.")
    role: str = Field(default="Viewer", description="Assigned team role.")


class ProjectMemberCreate(BaseModel):
    name: str = Field(..., min_length=2, description="Member name.")
    email: str = Field(..., description="Member email.")
    role: str = Field(default="Viewer", description="Assigned team role.")


class ProjectMemberUpdate(BaseModel):
    role: str = Field(..., description="Updated team role.")


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=2, description="Project name.")
    description: Optional[str] = Field("", description="Project scope and details.")
    frameworks: List[str] = Field(default_factory=list, description="Selected compliance frameworks.")


class ProjectCreate(ProjectBase):
    members: List[ProjectMember] = Field(default_factory=list, description="Initial project team members.")
    owner: Optional[str] = Field(None, description="Project owner name or email.")


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    description: Optional[str] = Field(None)
    frameworks: Optional[List[str]] = Field(None)
    members: Optional[List[ProjectMember]] = Field(None)
    owner: Optional[str] = Field(None)


class ProjectResponse(ProjectBase):
    id: str = Field(..., description="Unique project ID.")
    owner: str = Field(..., description="Project owner display info.")
    members: List[ProjectMember] = Field(default_factory=list, description="Assigned project members.")
    roles: List[str] = Field(default_factory=list, description="Distinct assigned team roles.")
    created_at: str = Field(..., description="Project creation ISO timestamp.")
    updated_at: str = Field(..., description="Project last modified ISO timestamp.")


# -----------------------------------------------------------------------------
# Authentication & Session Schemas
# -----------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str = Field(..., description="User login email.")
    password: str = Field(..., description="User login password.")


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT bearer access token.")
    token_type: str = Field(default="bearer", description="Token type.")
    expires_in: int = Field(default=86400, description="Expiration duration in seconds.")
    user: UserResponse = Field(..., description="Authenticated user object.")


class UserProfileResponse(BaseModel):
    user: UserResponse
    permissions: List[Permission]


# -----------------------------------------------------------------------------
# System Settings Schemas
# -----------------------------------------------------------------------------
class SystemSettings(BaseModel):
    llm_provider: str = Field(default="Groq Llama-3.3 70B Versatile", description="Active LLM engine.")
    neo4j_uri: str = Field(default="bolt://localhost:7687", description="Neo4j connection URI.")
    qdrant_url: str = Field(default="http://localhost:6333", description="Qdrant service URL.")
    embedding_model: str = Field(default="text-embedding-004", description="Embedding model name.")
    api_key_status: str = Field(default="Configured", description="API key status indicator.")
    theme: str = Field(default="light", description="Global UI theme mode.")
    security_audit_mode: bool = Field(default=True, description="Enforce granular RBAC audit logging.")


# -----------------------------------------------------------------------------
# Audit Log Schemas
# -----------------------------------------------------------------------------
class AuditLogResponse(BaseModel):
    id: str = Field(..., description="Audit log entry ID.")
    user_id: str = Field(..., description="Target user ID performing action.")
    user_email: str = Field(..., description="User email address.")
    role: str = Field(..., description="Role at time of action.")
    action: str = Field(..., description="Action tag (e.g., LOGIN, UPLOAD_DOCUMENT).")
    timestamp: str = Field(..., description="Action ISO timestamp.")
    ip_address: str = Field(..., description="Client IP address.")
    details: str = Field(..., description="Human readable description of action.")
