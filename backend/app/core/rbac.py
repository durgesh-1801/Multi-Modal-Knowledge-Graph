"""
Role-Based Access Control (RBAC) Core Enums and Permission Mapping.

Defines:
- Role Enum (ADMIN, COMPLIANCE_OFFICER, AUDITOR)
- Permission Enum (Granular application permissions)
- ROLE_PERMISSIONS Matrix Mapping
"""

from enum import Enum
from typing import Dict, Set


class Role(str, Enum):
    """Supported System User Roles."""
    ADMIN = "ADMIN"
    COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER"
    AUDITOR = "AUDITOR"


class Permission(str, Enum):
    """Granular Application Permissions."""

    # Project Management
    CREATE_PROJECT = "CREATE_PROJECT"
    DELETE_PROJECT = "DELETE_PROJECT"
    MANAGE_PROJECTS = "MANAGE_PROJECTS"

    # User Management
    MANAGE_USERS = "MANAGE_USERS"
    INVITE_USERS = "INVITE_USERS"
    CHANGE_USER_ROLE = "CHANGE_USER_ROLE"
    CHANGE_USER_STATUS = "CHANGE_USER_STATUS"

    # Document & Ingestion Management
    UPLOAD_DOCUMENT = "UPLOAD_DOCUMENT"
    DELETE_DOCUMENT = "DELETE_DOCUMENT"
    UPLOAD_AUDIO = "UPLOAD_AUDIO"
    TRIGGER_REINDEXING = "TRIGGER_REINDEXING"

    # Knowledge Graph Management
    MANAGE_GRAPH = "MANAGE_GRAPH"
    EDIT_GRAPH = "EDIT_GRAPH"
    DELETE_GRAPH_NODE = "DELETE_GRAPH_NODE"
    MERGE_ENTITIES = "MERGE_ENTITIES"
    VIEW_GRAPH = "VIEW_GRAPH"
    SEARCH_GRAPH = "SEARCH_GRAPH"

    # Analytics & Reports
    VIEW_ANALYTICS = "VIEW_ANALYTICS"
    VIEW_REPORTS = "VIEW_REPORTS"
    DOWNLOAD_REPORTS = "DOWNLOAD_REPORTS"
    VIEW_CITATIONS = "VIEW_CITATIONS"

    # AI Chat & RAG
    ASK_AI = "ASK_AI"

    # System & Audit
    MANAGE_SETTINGS = "MANAGE_SETTINGS"
    VIEW_LOGS = "VIEW_LOGS"


# Comprehensive Role-Permission Access Control Matrix
ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
    Role.ADMIN: {
        # All Permissions
        Permission.CREATE_PROJECT,
        Permission.DELETE_PROJECT,
        Permission.MANAGE_PROJECTS,
        Permission.MANAGE_USERS,
        Permission.INVITE_USERS,
        Permission.CHANGE_USER_ROLE,
        Permission.CHANGE_USER_STATUS,
        Permission.UPLOAD_DOCUMENT,
        Permission.DELETE_DOCUMENT,
        Permission.UPLOAD_AUDIO,
        Permission.TRIGGER_REINDEXING,
        Permission.MANAGE_GRAPH,
        Permission.EDIT_GRAPH,
        Permission.DELETE_GRAPH_NODE,
        Permission.MERGE_ENTITIES,
        Permission.VIEW_GRAPH,
        Permission.SEARCH_GRAPH,
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_REPORTS,
        Permission.DOWNLOAD_REPORTS,
        Permission.VIEW_CITATIONS,
        Permission.ASK_AI,
        Permission.MANAGE_SETTINGS,
        Permission.VIEW_LOGS,
    },
    Role.COMPLIANCE_OFFICER: {
        # Ingestion, RAG, Graph Browsing, Analytics & Reporting
        Permission.UPLOAD_DOCUMENT,
        Permission.UPLOAD_AUDIO,
        Permission.ASK_AI,
        Permission.VIEW_GRAPH,
        Permission.SEARCH_GRAPH,
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_CITATIONS,
        Permission.VIEW_REPORTS,
        Permission.DOWNLOAD_REPORTS,
        # Cannot: Manage Users, Edit/Delete Graph, System Settings, View Logs
    },
    Role.AUDITOR: {
        # Read-Only Inspection, Querying, Analytics & Reports
        Permission.ASK_AI,
        Permission.VIEW_GRAPH,
        Permission.SEARCH_GRAPH,
        Permission.VIEW_CITATIONS,
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_REPORTS,
        Permission.DOWNLOAD_REPORTS,
        # Cannot: Upload Documents/Audio, Modify Knowledge Graph, Manage Users, System Settings
    },
}


def has_permission(role: Role, permission: Permission) -> bool:
    """
    Check whether a given user role possesses a required permission.
    """
    granted_permissions = ROLE_PERMISSIONS.get(role, set())
    return permission in granted_permissions
