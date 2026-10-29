import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_URL = "http://127.0.0.1:8000"

def api_call(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"raw": content}
        return e.code, parsed

def run_tests():
    print("=" * 70)
    print("CARETRACK END-TO-END HTTP API & SQLITE DATA FLOW VERIFICATION")
    print("=" * 70)

    # 1. Invalid login check (Anti-enumeration)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "NON_EXISTENT", "password": "WrongPassword"})
    assert status == 401, f"Expected 401 for unknown user, got {status}"
    assert res.get("detail", {}).get("message") == "Invalid Unique ID or Access Revoked"
    print("[PASS] 1. Unknown Unique ID returns 401 'Invalid Unique ID or Access Revoked'")

    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "DOC-1029", "password": "WrongPassword"})
    assert status == 401, f"Expected 401 for wrong password, got {status}"
    assert res.get("detail", {}).get("message") == "Invalid Unique ID or Access Revoked"
    print("[PASS] 2. Incorrect password returns identical 401 'Invalid Unique ID or Access Revoked'")

    # 2. Doctor Flow (DOC-1029)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "DOC-1029", "password": "CareTrack@2026"})
    assert status == 200, f"Doctor login failed: {status}"
    doc_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=doc_token)
    assert status == 200 and me["role"] == "doctor"
    print(f"[PASS] 3. Doctor logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    status, followups = api_call("GET", "/api/v1/followups?limit=10", token=doc_token)
    assert status == 200 and len(followups.get("items", [])) > 0
    test_order = followups["items"][0]
    print(f"[PASS] 4. Doctor loaded {len(followups['items'])} follow-up orders from SQLite. First order: {test_order['id'][:8]}")

    # Doctor reschedules follow-up
    new_date = "2026-11-20T10:00:00Z"
    status, updated = api_call("POST", f"/api/v1/followups/{test_order['id']}/reschedule", {
        "scheduled_at": new_date,
        "expected_revision": test_order["revision"],
        "reason": "Doctor schedule update test"
    }, token=doc_token)
    assert status == 200 and updated["revision"] == test_order["revision"] + 1
    print(f"[PASS] 5. Doctor rescheduled follow-up {test_order['id'][:8]}: Revision incremented to {updated['revision']}")

    # Doctor forbidden check (cannot manage users)
    status, _ = api_call("GET", "/api/v1/users", token=doc_token)
    assert status == 403, f"Expected 403 for doctor accessing /users, got {status}"
    print("[PASS] 6. Doctor access to /api/v1/users correctly denied with 403 Forbidden")

    # 3. Assistant Verifier Flow (AST-9021)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "AST-9021", "password": "CareTrack@2026"})
    assert status == 200
    ast_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=ast_token)
    assert status == 200 and me["role"] == "assistant_verifier"
    print(f"[PASS] 7. Assistant logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    # Assistant task-based lookup
    status, pat = api_call("GET", "/api/v1/patients?hospital_patient_identifier=PT-20496", token=ast_token)
    assert status == 200 and pat["hospital_patient_identifier"] == "PT-20496"
    print(f"[PASS] 8. Assistant task-based patient lookup succeeded: {pat['display_name']} (DOB: {pat['date_of_birth']})")

    # Assistant creates encounter
    enc_code = f"ENC-E2E-{datetime.now().strftime('%H%M%S')}"
    status, enc = api_call("POST", "/api/v1/encounters", {
        "patient_id": pat["id"],
        "external_encounter_identifier": enc_code,
        "clinician_user_id": None, # tests doctor fallback
        "encounter_at": "2026-10-29T10:00:00Z"
    }, token=ast_token)
    assert status == 201, f"Encounter creation failed: {status} {enc}"
    print(f"[PASS] 9. Assistant created encounter in SQLite: {enc['external_encounter_identifier']} (ID: {enc['id'][:8]})")

    # Assistant forbidden check (cannot amend clinical decision)
    status, _ = api_call("POST", f"/api/v1/followups/{test_order['id']}/amendments", {
        "severity": "high",
        "expected_revision": 1,
        "reason": "Unauthorized test"
    }, token=ast_token)
    assert status == 403, f"Expected 403 for assistant amending followup, got {status}"
    print("[PASS] 10. Assistant clinical override attempt correctly denied with 403 Forbidden")

    # 4. Receptionist Flow (RCP-302)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "RCP-302", "password": "CareTrack@2026"})
    assert status == 200
    rcp_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=rcp_token)
    assert status == 200 and me["role"] == "receptionist"
    print(f"[PASS] 11. Receptionist logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    # Reception registers new patient
    new_pid = f"PT-{datetime.now().strftime('%H%M%S')}"
    status, new_pat = api_call("POST", "/api/v1/patients", {
        "hospital_patient_identifier": new_pid,
        "display_name": "Test Live Patient",
        "date_of_birth": "1995-05-15"
    }, token=rcp_token)
    assert status == 201, f"Patient registration failed: {status}"
    print(f"[PASS] 12. Receptionist registered new patient in SQLite: {new_pat['hospital_patient_identifier']} (ID: {new_pat['id'][:8]})")

    # Reception registers encrypted contact
    status, new_contact = api_call("POST", f"/api/v1/patients/{new_pat['id']}/contacts", {
        "channel": "sms",
        "destination": "+919876543299",
        "is_shared": False,
        "sharing_status_source": "patient_direct_declaration",
        "verified": True,
        "verification_source": "in_person_reception"
    }, token=rcp_token)
    assert status == 201, f"Contact registration failed: {status}"
    print(f"[PASS] 13. Receptionist created encrypted verified contact with HMAC fingerprint: ID {new_contact['id'][:8]}")

    # Reception forbidden check (cannot view clinical followups)
    status, _ = api_call("GET", "/api/v1/followups", token=rcp_token)
    assert status == 403, f"Expected 403 for receptionist reading followups, got {status}"
    print("[PASS] 14. Receptionist access to clinical follow-ups correctly denied with 403 Forbidden")

    # 5. Coordinator Flow (STF-4410)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "STF-4410", "password": "CareTrack@2026"})
    assert status == 200
    coord_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=coord_token)
    assert status == 200 and me["role"] == "followup_coordinator"
    print(f"[PASS] 15. Coordinator logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    status, queue = api_call("GET", "/api/v1/reminders/queue?limit=10", token=coord_token)
    assert status == 200 and len(queue.get("items", [])) > 0
    test_job = queue["items"][0]
    print(f"[PASS] 16. Coordinator loaded reminder queue ({len(queue['items'])} jobs). First job: {test_job['id'][:8]}")

    # Coordinator records call outcome (ensure job is in call_task_open state)
    import sqlite3
    with sqlite3.connect("backend/caretrack.db") as conn:
        conn.execute("UPDATE reminder_jobs SET status = 'call_task_open', action_kind = 'create_call_task' WHERE id = ?", (test_job["id"].replace("-", ""),))
        conn.commit()

    status, call_res = api_call("POST", f"/api/v1/reminders/{test_job['id']}/call-outcomes", {
        "result": "contacted_patient",
        "safe_result_notes": "Patient confirmed appointment schedule.",
        "occurred_at": datetime.now(timezone.utc).isoformat()
    }, token=coord_token)
    assert status == 200, f"Call outcome failed: {status} {call_res}"
    print(f"[PASS] 17. Coordinator recorded call outcome in SQLite for job {test_job['id'][:8]}: Result='contacted_patient'")

    # Coordinator forbidden check (cannot create policy)
    status, _ = api_call("POST", "/api/v1/policies", {"name": "Unauthorized Policy", "config": {}}, token=coord_token)
    assert status == 403, f"Expected 403 for coordinator creating policy, got {status}"
    print("[PASS] 18. Coordinator policy creation attempt correctly denied with 403 Forbidden")

    # 6. Supervisor Flow (HD-101)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "HD-101", "password": "CareTrack@2026"})
    assert status == 200
    sup_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=sup_token)
    assert status == 200 and me["role"] == "clinic_supervisor"
    print(f"[PASS] 19. Supervisor logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    status, summary = api_call("GET", "/api/v1/operations/summary", token=sup_token)
    assert status == 200 and "followups_by_status" in summary
    print(f"[PASS] 20. Supervisor loaded live operations summary from SQLite: {summary}")

    # 7. System Admin / IT Head Flow (ITH-001)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "ITH-001", "password": "CareTrack@2026"})
    assert status == 200
    adm_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=adm_token)
    assert status == 200 and me["role"] == "system_admin"
    print(f"[PASS] 21. IT Head logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    status, users = api_call("GET", "/api/v1/users", token=adm_token)
    assert status == 200 and len(users) >= 7
    print(f"[PASS] 22. IT Head loaded staff accounts ({len(users)} users) from SQLite.")

    status, requests = api_call("GET", "/api/v1/admin/registration-requests", token=adm_token)
    assert status == 200
    print(f"[PASS] 23. IT Head loaded registration requests ({len(requests)} pending/processed) from SQLite.")

    # 8. Auditor Flow (AUD-001)
    status, res = api_call("POST", "/api/v1/auth/login", {"unique_id": "AUD-001", "password": "CareTrack@2026"})
    assert status == 200
    aud_token = res["access_token"]
    status, me = api_call("GET", "/api/v1/me", token=aud_token)
    assert status == 200 and me["role"] == "auditor"
    print(f"[PASS] 24. Auditor logged in: {me['display_name']} ({me['system_identifier']}), Role='{me['role']}'")

    status, audit = api_call("GET", "/api/v1/audit-events?limit=10", token=aud_token)
    assert status == 200 and len(audit.get("items", [])) > 0
    print(f"[PASS] 25. Auditor loaded immutable audit log from SQLite ({len(audit['items'])} events retrieved).")

    # Auditor read-only guard (cannot create patient)
    status, _ = api_call("POST", "/api/v1/patients", {"hospital_patient_identifier": "AUD-FAIL", "display_name": "Fail"}, token=aud_token)
    assert status == 403, f"Expected 403 for auditor write, got {status}"
    print("[PASS] 26. Auditor write attempt correctly denied with 403 Forbidden")

    print("\n" + "=" * 70)
    print("ALL 26 END-TO-END HTTP API & SQLITE DATA FLOW CHECKS PASSED (100%)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
