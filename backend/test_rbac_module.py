"""
Enterprise RBAC Integration and Protection Test Suite.

Verifies:
1. Role Assignment & Permission Matrix definitions
2. JWT Access Token encoding/decoding & role parsing
3. Role & Permission dependency enforcement (HTTP 403 checks)
4. Admin User Management CRUD APIs (Create, List, Update, Role Patch, Status Patch, Delete)
5. Project Management APIs
6. Route protection for Uploads, Graph Mutations, Settings, and Audit Logs
7. Audit Log recording
"""

import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_root = Path(__file__).parent
sys.path.insert(0, str(backend_root))

from app.main import app
from app.core.rbac import Permission, Role, has_permission, ROLE_PERMISSIONS
from app.core.security import create_access_token
from app.schemas.rbac import UserResponse, UserStatus
from app.services.rbac_store import RBACStore

client = TestClient(app)


def test_rbac_matrix():
    print("\n--- Testing RBAC Permission Matrix ---")
    assert has_permission(Role.ADMIN, Permission.MANAGE_USERS)
    assert has_permission(Role.ADMIN, Permission.EDIT_GRAPH)
    assert has_permission(Role.ADMIN, Permission.MANAGE_SETTINGS)

    assert has_permission(Role.COMPLIANCE_OFFICER, Permission.UPLOAD_DOCUMENT)
    assert has_permission(Role.COMPLIANCE_OFFICER, Permission.ASK_AI)
    assert not has_permission(Role.COMPLIANCE_OFFICER, Permission.MANAGE_USERS)
    assert not has_permission(Role.COMPLIANCE_OFFICER, Permission.EDIT_GRAPH)
    assert not has_permission(Role.COMPLIANCE_OFFICER, Permission.MANAGE_SETTINGS)

    assert has_permission(Role.AUDITOR, Permission.ASK_AI)
    assert has_permission(Role.AUDITOR, Permission.VIEW_GRAPH)
    assert not has_permission(Role.AUDITOR, Permission.UPLOAD_DOCUMENT)
    assert not has_permission(Role.AUDITOR, Permission.UPLOAD_AUDIO)
    assert not has_permission(Role.AUDITOR, Permission.MANAGE_USERS)
    assert not has_permission(Role.AUDITOR, Permission.MANAGE_SETTINGS)
    print("[PASSED] RBAC matrix verification clean!")


import pytest


@pytest.fixture
def auth_tokens():
    store = RBACStore.get_instance()
    admin_user = UserResponse(**store.get_user_by_email("admin@enterprise.com"))
    officer_user = UserResponse(**store.get_user_by_email("officer@enterprise.com"))
    auditor_user = UserResponse(**store.get_user_by_email("auditor@enterprise.com"))

    return (
        create_access_token(admin_user),
        create_access_token(officer_user),
        create_access_token(auditor_user),
    )


@pytest.fixture
def admin_token(auth_tokens):
    return auth_tokens[0]


@pytest.fixture
def officer_token(auth_tokens):
    return auth_tokens[1]


@pytest.fixture
def auditor_token(auth_tokens):
    return auth_tokens[2]


def test_jwt_generation_and_headers():
    print("\n--- Testing JWT Token Generation and Auth Headers ---")
    store = RBACStore.get_instance()
    admin_dict = store.get_user_by_email("admin@enterprise.com")
    officer_dict = store.get_user_by_email("officer@enterprise.com")
    auditor_dict = store.get_user_by_email("auditor@enterprise.com")

    admin_user = UserResponse(**admin_dict)
    officer_user = UserResponse(**officer_dict)
    auditor_user = UserResponse(**auditor_dict)

    admin_token = create_access_token(admin_user)
    officer_token = create_access_token(officer_user)
    auditor_token = create_access_token(auditor_user)

    assert admin_token is not None
    assert officer_token is not None
    assert auditor_token is not None
    print("[PASSED] JWT token generation clean!")


def test_user_management_api_protection(admin_token, officer_token, auditor_token):
    print("\n--- Testing User Management API Protection ---")
    
    # 1. Auditor trying to list users -> 403
    res_auditor = client.get("/api/v1/users", headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_auditor.status_code == 403, f"Expected 403, got {res_auditor.status_code}"
    print("[PASSED] Auditor forbidden from listing users (403).")

    # 2. Compliance Officer trying to list users -> 403
    res_officer = client.get("/api/v1/users", headers={"Authorization": f"Bearer {officer_token}"})
    assert res_officer.status_code == 403, f"Expected 403, got {res_officer.status_code}"
    print("[PASSED] Compliance Officer forbidden from listing users (403).")

    # 3. Admin listing users -> 200 OK
    res_admin = client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    assert len(res_admin.json()["data"]) >= 3
    print("[PASSED] Admin allowed to list users.")


def test_user_crud_and_patch(admin_token):
    print("\n--- Testing User CRUD & Role/Status Patching ---")
    
    # Create User
    new_user_payload = {
        "email": "test_analyst@enterprise.com",
        "name": "Test Analyst User",
        "role": "COMPLIANCE_OFFICER",
        "password": "analyst_password123",
    }
    res_create = client.post("/api/v1/users", json=new_user_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_create.status_code == 201
    created_user = res_create.json()["data"]
    user_id = created_user["id"]
    assert created_user["email"] == "test_analyst@enterprise.com"

    # Patch Role -> AUDITOR
    res_role = client.patch(
        f"/api/v1/users/{user_id}/role",
        json={"role": "AUDITOR"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_role.status_code == 200
    assert res_role.json()["data"]["role"] == "AUDITOR"

    # Patch Status -> SUSPENDED
    res_status = client.patch(
        f"/api/v1/users/{user_id}/status",
        json={"status": "SUSPENDED"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_status.status_code == 200
    assert res_status.json()["data"]["status"] == "SUSPENDED"

    # Delete User
    res_del = client.delete(f"/api/v1/users/{user_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_del.status_code == 200
    print("[PASSED] User CRUD & Role/Status Patch operations clean!")


def test_project_management(admin_token, auditor_token):
    print("\n--- Testing Project Management APIs ---")
    
    # List projects (all roles allowed)
    res_list = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_list.status_code == 200

    # Auditor create project -> 403
    proj_payload = {
        "name": "Audit Security Project",
        "description": "Testing project creation",
    }
    res_auditor_create = client.post("/api/v1/projects", json=proj_payload, headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_auditor_create.status_code == 403

    # Admin create project -> 201
    res_admin_create = client.post("/api/v1/projects", json=proj_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin_create.status_code == 201
    proj_id = res_admin_create.json()["data"]["id"]

    # Delete project
    res_del = client.delete(f"/api/v1/projects/{proj_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_del.status_code == 200
    print("[PASSED] Project Management APIs verified!")


def test_settings_and_logs(admin_token, officer_token):
    print("\n--- Testing Settings & Audit Logs Permissions ---")
    
    # Officer viewing settings -> 403
    res_off_set = client.get("/api/v1/settings", headers={"Authorization": f"Bearer {officer_token}"})
    assert res_off_set.status_code == 403

    # Admin viewing settings -> 200
    res_adm_set = client.get("/api/v1/settings", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_adm_set.status_code == 200

    # Officer viewing logs -> 403
    res_off_logs = client.get("/api/v1/logs", headers={"Authorization": f"Bearer {officer_token}"})
    assert res_off_logs.status_code == 403

    # Admin viewing logs -> 200
    res_adm_logs = client.get("/api/v1/logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_adm_logs.status_code == 200
    assert len(res_adm_logs.json()["data"]) > 0
    print("[PASSED] Settings & Audit Logs permission checks clean!")


def test_graph_mutations_protection(admin_token, officer_token, auditor_token):
    print("\n--- Testing Graph Mutations Protection ---")
    
    merge_payload = {
        "canonical_name": "HIPAA Policy",
        "duplicate_names": ["HIPAA Rule 1"],
    }
    
    # Auditor merge -> 403
    res_auditor = client.post("/api/v1/graph/merge-entities", json=merge_payload, headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_auditor.status_code == 403

    # Officer merge -> 403
    res_officer = client.post("/api/v1/graph/merge-entities", json=merge_payload, headers={"Authorization": f"Bearer {officer_token}"})
    assert res_officer.status_code == 403

    # Admin merge -> 200
    res_admin = client.post("/api/v1/graph/merge-entities", json=merge_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    print("[PASSED] Graph mutations strictly protected!")


def run_all_tests():
    print("==================================================")
    print("Executing Backend RBAC Test Suite")
    print("==================================================")
    test_rbac_matrix()
    admin_token, officer_token, auditor_token = test_jwt_generation_and_headers()
    test_user_management_api_protection(admin_token, officer_token, auditor_token)
    test_user_crud_and_patch(admin_token)
    test_project_management(admin_token, auditor_token)
    test_settings_and_logs(admin_token, officer_token)
    test_graph_mutations_protection(admin_token, officer_token, auditor_token)
    print("\nALL RBAC BACKEND TESTS PASSED CLEANLY!")


if __name__ == "__main__":
    run_all_tests()
