# CareTrack: Clinical Follow-Up & Intake Management System
> **AI Context & Developer System Profile**: This document is the primary architectural, operational, and integration blueprint for CareTrack. Any AI coding model or engineer reading this repository should reference this document for immediate full-context alignment without repetitive discovery.

---

## 1. Executive System Overview & Tech Stack

CareTrack is an enterprise-grade clinical follow-up management and intake workflow system designed for multi-role outpatient healthcare facilities. It integrates paper scan intake, doctor clinical decisions, assistant demographic and chart verification, patient registration, phone contact resolution, HIPAA-compliant encryption, automated reminder job queuing, and immutable compliance audit logging.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │           React 18 + Vite + Tailwind Frontend           │
                  │   (7 Role Dashboards, Live Polling, Anti-Enumeration)   │
                  └────────────────────────────┬────────────────────────────┘
                                               │ HTTP / REST (Bearer Auth)
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                 FastAPI Python Backend                  │
                  │ (Role RBAC, Pydantic v2, AES-GCM Crypto, Audit Engine)  │
                  └────────────────────────────┬────────────────────────────┘
                                               │ SQLAlchemy ORM
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │             Authoritative SQLite Database               │
                  │     D:\Fire_Flies\backend\caretrack.db (Single Truth)   │
                  └─────────────────────────────────────────────────────────┘
```

### Core Technology Stack
| Layer | Technologies & Tools | Authoritative Location |
| :--- | :--- | :--- |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn | `backend/app/` |
| **Database** | SQLite (`caretrack.db`) — **Single Source of Truth** | `backend/caretrack.db` |
| **Frontend** | React 18, Vite 5, TypeScript 5.2, Tailwind CSS, Lucide React | `frontend/src/` |
| **Security** | PBKDF2-HMAC-SHA256, AES-256-GCM, HMAC-SHA256 phone fingerprinting | `backend/app/core/` |
| **Testing** | Node.js integration runner (`verify-integration.mjs`), Python E2E suite (`verify_full_e2e_data_flows.py`) | `frontend/scripts/`, `backend/scripts/` |

> [!IMPORTANT]
> **Single Source of Truth Policy**: All patient records, encounters, follow-ups, contacts, reminder jobs, policies, and audit logs are persisted exclusively in `backend/caretrack.db`. The frontend does NOT use `localStorage`, `sessionStorage`, or fictional arrays as sources of truth. Live state synchronization is managed via controlled interval polling and focus-regained triggers via `useLiveRefresh`.

---

## 2. Authentication, Roles & RBAC Architecture

### Authentication Mechanism
* **Endpoint**: `POST /api/v1/auth/login`
* **Sign-In Form Contract**: Contains **only two fields**: `unique_id` (Generated Unique ID) and `password`. The user **never** selects a role during sign-in.
* **Backend Resolution**:
  1. Backend looks up user by `system_identifier` (case-insensitive) or `username`.
  2. Verifies password against PBKDF2-HMAC-SHA256 hash (resilient to accidental whitespace).
  3. Verifies account `is_active == True` and `status == "active"`.
  4. Returns development bearer token with role embedded in database user profile.
  5. The frontend calls `GET /api/v1/me` to resolve the role and render the corresponding dashboard.
* **Uniform Anti-Enumeration Protection**: For any unknown ID, incorrect password, deactivated account, or revoked status, the backend returns identical HTTP 401:
  ```json
  { "detail": { "code": "invalid_credentials", "message": "Invalid Unique ID or Access Revoked" } }
  ```

### Pre-Provisioned Staff Identities & Role Mapping
All demo accounts are provisioned in `caretrack.db` with universal password: `CareTrack@2026`.

| Generated Unique ID | User Display Name | Backend Role (`User.role`) | Department | Dashboard Screen | Primary Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DOC-1029` | Dr. Amelia Reed | `doctor` | Cardiology | `DoctorDashboardScreen` | `followup:read`, `followup:amend`, `followup:complete`, `followup:cancel`, `scan:decision`, `patient:read`, `patient:manage`, `contact:reveal` |
| `AST-9021` | Dr. Marcus Chen | `assistant_verifier` | Emergency Medicine | `AssistantIntakeScreen` | `patient:read`, `patient:manage`, `scan:upload`, `scan:process`, `scan:verify`, `followup:read` |
| `STF-4410` | James Okafor | `followup_coordinator` | Laboratory | `CoordinatorTriageScreen` | `reminder:read_queue`, `reminder:record_call`, `contact:resolve`, `contact:manage`, `followup:complete`, `followup:read` |
| `HD-101` | Nadia Williams | `clinic_supervisor` | Nursing Operations | `StaffHeadDashboardScreen` | `operations:read`, `policy:create`, `policy:approve`, `policy:activate`, `reminder:retry_review`, `followup:cancel`, `audit:read` |
| `RCP-302` | Priya Nair | `receptionist` | Front Office | `ReceptionDeskScreen` | `patient:read`, `patient:manage`, `contact:read`, `contact:manage` |
| `ITH-001` | IT Head | `system_admin` | Security Operations | `ITHeadAdminScreen` | `user:manage`, `operations:read`, `policy:create`, `system:config`, `audit:read` |
| `AUD-001` | Compliance Auditor | `auditor` | Compliance | `AuditorScreen` | `audit:read`, `followup:read`, `policy:read`, `operations:read` (Read-only) |

---

## 3. Verified End-to-End Data Flow Mapping Table

Every user action, frontend function, API endpoint, database write, and related record side-effect is mapped below:

| # | Screen & Role | Action / UI Trigger | Frontend API Function | Method & Endpoint | Request Payload | Response Payload | SQLite Table / Model | Related Records & Side Effects |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Universal (`LoginModal`) | Staff Sign-In | `login(uniqueId, pwd)` | `POST /api/v1/auth/login` | `{ unique_id, password }` | `{ access_token, role, system_identifier, display_name }` | `users` | Logs `auth.login` in `audit_events`; updates `last_login_at`. |
| **2** | Universal (`App.tsx`) | Resolve User Profile | `fetchCurrentUser()` | `GET /api/v1/me` | *Headers: Bearer Token* | `MeOut` (`id, role, display_name, system_identifier, permissions`) | `users` | Validates session token and active account status. |
| **3** | Universal (`LoginModal`) | Public Registration Request | `requestRegistration(data)` | `POST /api/v1/auth/register-request` | `{ full_name, work_email, department, requested_role, password, certification_agreed }` | `RegistrationRequestOut` (`id, status: "pending"`) | `registration_requests` | Stored as `pending`. No user created or unique ID issued until admin approval. |
| **4** | `DoctorDashboardScreen` (`doctor`) | Load Follow-Up Orders List | `listFollowups(params)` | `GET /api/v1/followups` | `params: { status, limit }` | `{ items: FollowupOut[], limit, offset }` | `followup_orders`, `patients`, `encounters` | Scoped strictly to doctor's `facility_id`. |
| **5** | `DoctorDashboardScreen` (`doctor`) | Reschedule Follow-Up Date | `rescheduleFollowup(id, data)` | `POST /api/v1/followups/{id}/reschedule` | `{ scheduled_at, reason, expected_revision }` | `FollowupOut` | `followup_orders`, `reminder_jobs` | Increments `revision`; cancels pending reminder jobs and re-runs schedule generator. |
| **6** | `DoctorDashboardScreen` (`doctor`) | Mark Follow-Up Completed | `completeFollowup(id, data)` | `POST /api/v1/followups/{id}/complete` | `{ outcome_category, clinical_notes }` | `FollowupOut` (`status: "completed"`) | `followup_orders`, `reminder_jobs` | Transitions status to `completed`; cancels all open/pending reminder jobs; logs audit event. |
| **7** | `DoctorDashboardScreen` (`doctor`) | Cancel Clinical Follow-Up | `cancelFollowup(id, data)` | `POST /api/v1/followups/{id}/cancel` | `{ reason }` | `FollowupOut` (`status: "cancelled"`) | `followup_orders`, `reminder_jobs` | Cancels follow-up and associated reminder jobs with immutable reason. |
| **8** | `AssistantIntakeScreen` (`assistant_verifier`) | Task-Based Patient Lookup | `lookupPatient(id)` | `GET /api/v1/patients?hospital_patient_identifier={id}` | Query: `hospital_patient_identifier` | `PatientOut` (`id, hospital_patient_identifier, display_name, date_of_birth`) | `patients` | Anti-enumeration check. Returns 404 if patient is not verified chart record. |
| **9** | `AssistantIntakeScreen` (`assistant_verifier`) | Submit Clinical Encounter | `createEncounter(data)` | `POST /api/v1/encounters` | `{ patient_id, external_encounter_identifier, clinician_user_id?, encounter_at }` | `EncounterOut` (`id, external_encounter_identifier, ...`) | `encounters` | Created by assistant; automatically assigns facility active doctor (`DOC-1029`) if clinician ID omitted. |
| **10** | `ReceptionDeskScreen` (`receptionist`) | Register New Patient | `createPatient(data)` | `POST /api/v1/patients` | `{ hospital_patient_identifier, display_name, date_of_birth }` | `PatientOut` (`id, hospital_patient_identifier, ...`) | `patients` | Creates patient chart with `identity_status: "verified"`. |
| **11** | `ReceptionDeskScreen` (`receptionist`) | Add Patient Primary Contact | `createContact(pid, data)` | `POST /api/v1/patients/{id}/contacts` | `{ channel: "voice", destination, is_shared: false, sharing_status_source, verified, verification_source }` | `ContactOut` (`id, destination_masked, channel, verified`) | `patient_contacts` | Normalizes to E.164 (`+91...`); encrypts with AES-256-GCM; indexes HMAC-SHA256 fingerprint. |
| **12** | `ReceptionDeskScreen` (`receptionist`) | Add Family/Shared Contact | `createContact(pid, data)` | `POST /api/v1/patients/{id}/contacts` | `{ channel: "sms", destination, is_shared: true, sharing_status_source: "patient_declared_child" }` | `ContactOut` | `patient_contacts` | Records sharing evidence source required by security guidelines. |
| **13** | `CoordinatorTriageScreen` (`followup_coordinator`) | Fetch Pending Reminder Queue | `getReminderQueue(params)` | `GET /api/v1/reminders/queue` | `params: { limit, status? }` | `{ items: ReminderOut[] }` | `reminder_jobs`, `patients`, `followup_orders` | Retrieves actionable queue items (`call_task_open`, `scheduled`, `retry_wait`). |
| **14** | `CoordinatorTriageScreen` (`followup_coordinator`) | Record Staff Call Outcome | `recordCallOutcome(jobId, data)` | `POST /api/v1/reminders/{id}/call-outcomes` | `{ result: "contacted_patient", safe_result_notes, occurred_at }` | `{ status: "success", job_id, result }` | `communication_attempts`, `reminder_jobs` | Records call attempt; marks reminder job completed; advances follow-up progress. |
| **15** | `StaffHeadDashboardScreen` (`clinic_supervisor`) | Load Operations Metrics | `getOperationsSummary()` | `GET /api/v1/operations/summary` | *None* | `{ followups_by_status, followups_by_severity, overdue_followups, reminder_jobs_by_status, scans_by_processing_status }` | `followup_orders`, `reminder_jobs`, `scan_documents` | Live operational roll-up metrics across clinic operations. |
| **16** | `StaffHeadDashboardScreen` (`clinic_supervisor`) | Review Failed Job Retry | `submitRetryReview(jobId, data)` | `POST /api/v1/reminders/{id}/retry-review` | `{ action: "approve_retry", notes }` | `ReminderOut` | `reminder_jobs` | Supervisor unblocks or re-queues retry jobs after delivery failures. |
| **17** | `StaffHeadDashboardScreen` (`clinic_supervisor`) | View Clinic Policies | `listPolicies()` | `GET /api/v1/policies` | *None* | `PolicyOut[]` (`id, name, version, is_active, config`) | `policy_versions` | Retrieves versioned reminder milestones and notification intervals. |
| **18** | `ITHeadAdminScreen` (`system_admin`) | List Staff User Accounts | `listUsers()` | `GET /api/v1/users` | *None* | `UserOut[]` | `users` | Administrator user directory with role and active status. |
| **19** | `ITHeadAdminScreen` (`system_admin`) | View Registration Requests | `listRegistrationRequests()` | `GET /api/v1/admin/registration-requests` | *None* | `RegistrationRequestOut[]` | `registration_requests` | Lists pending employee account requests. |
| **20** | `ITHeadAdminScreen` (`system_admin`) | Approve Staff Account | `approveRegistrationRequest(id)` | `POST /api/v1/admin/registration-requests/{id}/approve` | *None* | `{ message, system_identifier, user_id }` | `users`, `registration_requests` | Allots Generated Unique ID (e.g. `DOC-XXXX`), sets status to active, generates staff profile. |
| **21** | `ITHeadAdminScreen` (`system_admin`) | Revoke User Access | `revokeUserAccess(userId, data)` | `POST /api/v1/users/{id}/revoke` | `{ reason }` | `UserOut` (`status: "revoked", is_active: false`) | `users` | Immediately revokes login privileges and invalidates future auth tokens. |
| **22** | `ITHeadAdminScreen` (`system_admin`) | Restore User Access | `restoreUserAccess(userId, data)` | `POST /api/v1/users/{id}/restore` | `{ reason }` | `UserOut` (`status: "active", is_active: true`) | `users` | Restores account access to active status. |
| **23** | `AuditorScreen` (`auditor`) | Load Audit Log Trail | `listAuditEvents(params)` | `GET /api/v1/audit/events` | `params: { limit: 50 }` | `{ items: AuditEventOut[], total }` | `audit_events` | Immutable compliance log of all logins, clinical updates, cancellations, and administrative actions. |

---

## 4. Key SQLite Database Schema & Entity Relationships

The authoritative database resides at `backend/caretrack.db`. The primary tables and relational foreign keys include:

```mermaid
erDiagram
    FACILITY ||--o{ USER : "employs"
    FACILITY ||--o{ PATIENT : "serves"
    FACILITY ||--o{ POLICY_VERSION : "configures"
    PATIENT ||--o{ PATIENT_CONTACT : "has"
    PATIENT ||--o{ ENCOUNTER : "attends"
    PATIENT ||--o{ FOLLOWUP_ORDER : "receives"
    USER ||--o{ ENCOUNTER : "clinician"
    USER ||--o{ FOLLOWUP_ORDER : "creates"
    ENCOUNTER ||--o{ SCAN_DOCUMENT : "documents"
    ENCOUNTER ||--o{ FOLLOWUP_ORDER : "triggers"
    FOLLOWUP_ORDER ||--o{ REMINDER_JOB : "schedules"
    REMINDER_JOB ||--o{ COMMUNICATION_ATTEMPT : "executes"
    USER ||--o{ AUDIT_EVENT : "actor"
```

### Table Definitions & Constraints
1. **`users`**:
   - `id` (CHAR(32) UUID PK), `facility_id` (FK), `username`, `display_name`, `role`, `department`, `is_active` (BOOLEAN), `system_identifier` (VARCHAR(64) UNIQUE, e.g. `DOC-1029`), `password_hash` (PBKDF2-HMAC-SHA256), `work_email`, `status` (`active` | `revoked`).
2. **`patients`**:
   - `id` (UUID PK), `facility_id` (FK), `hospital_patient_identifier` (VARCHAR(120), e.g. `PT-20496`), `display_name`, `date_of_birth` (DATE), `identity_status` (`verified` | `pending`).
3. **`patient_contacts`**:
   - `id` (UUID PK), `patient_id` (FK), `channel` (`voice` | `sms`), `destination_encrypted` (AES-256-GCM ciphertext), `destination_fingerprint` (HMAC-SHA256 for duplicate detection), `is_shared` (BOOLEAN), `sharing_status_source` (VARCHAR(120), e.g. `patient_direct_declaration`), `verified` (BOOLEAN), `verification_source`.
4. **`encounters`**:
   - `id` (UUID PK), `facility_id` (FK), `patient_id` (FK), `clinician_user_id` (FK to `users`), `external_encounter_identifier` (VARCHAR(120)), `encounter_at` (DATETIME).
5. **`followup_orders`**:
   - `id` (UUID PK), `facility_id` (FK), `patient_id` (FK), `encounter_id` (FK), `created_by_clinician_id` (FK to `users`), `verified_by_user_id` (FK to `users`), `followup_required` (BOOLEAN), `severity` (`normal` | `moderate` | `severe`), `scheduled_at` (DATETIME), `status` (`active` | `pending_verification` | `completed` | `cancelled` | `contact_resolution_required`), `revision` (INT).
6. **`reminder_jobs`**:
   - `id` (UUID PK), `facility_id` (FK), `followup_order_id` (FK), `action_kind` (`send_message` | `create_call_task`), `channel` (`sms` | `staff_call`), `status` (`scheduled` | `call_task_open` | `completed` | `cancelled` | `retry_wait`), `scheduled_at` (DATETIME).
7. **`policy_versions`**:
   - `id` (UUID PK), `facility_id` (FK), `name`, `version` (INT), `config` (JSON intervals & templates), `is_active` (BOOLEAN).
8. **`registration_requests`**:
   - `id` (UUID PK), `facility_id` (FK), `full_name`, `work_email`, `department`, `requested_role`, `password_hash`, `certification_agreed` (BOOLEAN), `status` (`pending` | `approved` | `rejected`).
9. **`audit_events`**:
   - `id` (UUID PK), `facility_id` (FK), `actor_user_id` (FK to `users`), `event_type`, `resource_type`, `resource_id`, `details` (JSON), `created_at` (DATETIME).

---

## 5. Critical Development Gotchas & Rules for AI Agents

> [!CAUTION]
> **1. SQLite Naive Datetime Handling**:
> SQLite stores datetimes without timezone offsets. When SQLAlchemy deserializes datetimes from SQLite, Python returns naive `datetime` objects (`tzinfo is None`).
> *Always* use `to_utc()` from [backend/app/services/time_utils.py](file:///D:/Fire_Flies/backend/app/services/time_utils.py#L28-L32):
> ```python
> def to_utc(value: datetime) -> datetime:
>     if value.tzinfo is None:
>         return value.replace(tzinfo=timezone.utc)
>     return value.astimezone(timezone.utc)
> ```
> Never throw 422 for naive datetimes read from the local database.

> [!WARNING]
> **2. Patient Contact Creation Requirements**:
> Endpoint `POST /api/v1/patients/{patient_id}/contacts` strictly validates HIPAA evidence rules:
> - If `is_shared == False`, `sharing_status_source` MUST be `"patient_direct_declaration"`.
> - If `is_shared == True`, `sharing_status_source` MUST be provided (e.g. `"patient_declared_child"`, `"patient_declared_spouse"`).
> - If `verified == True`, `verification_source` MUST be supplied (e.g. `"in_person_reception"`).
> - Phone numbers MUST be formatted in E.164 international notation (`+919876543210`). Use `cleanIntlPhone()` helper.

> [!NOTE]
> **3. Assistant Encounter Submissions & Doctor Fallback**:
> When an assistant verifier (`AST-9021`) submits an encounter on Step 03 of intake, `clinician_user_id` should be omitted or `undefined`. The backend schema [backend/app/schemas.py](file:///D:/Fire_Flies/backend/app/schemas.py#L58-L63) marks `clinician_user_id: UUID | None = None` and automatically assigns the facility's active doctor (`DOC-1029`).

> [!IMPORTANT]
> **4. Windows Sandbox Networking**:
> In Windows PowerShell sandbox environments, running test scripts that connect to local sockets (`http://127.0.0.1:8000`) requires `BypassSandbox: true` to prevent `WinError 10013` / `WinError 10061` socket permission blocks.

---

## 6. Commands & Verification Cheat Sheet

### Start Local Development Servers
```powershell
# 1. Start FastAPI Backend Daemon (Port 8000, Auto-Reload)
cd D:\Fire_Flies\backend
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Start React/Vite Frontend Server (Port 5173)
cd D:\Fire_Flies\frontend
pnpm dev
```

### Database Seeding & Bootstrap
```powershell
# Re-initialize seed facilities, 7 default staff accounts, and 6 clinical patients
cd D:\Fire_Flies\backend
.\.venv\Scripts\python.exe -m scripts.bootstrap
```

### Run Automated Integration & E2E Test Suites
```powershell
# 1. Run 30-Scenario Contract & Integration Test Suite
cd D:\Fire_Flies
node frontend/scripts/verify-integration.mjs

# 2. Run 26-Check End-to-End SQLite & HTTP API Data Flow Suite (BypassSandbox: true)
cd D:\Fire_Flies
backend\.venv\Scripts\python.exe backend/scripts/verify_full_e2e_data_flows.py

# 3. Typecheck & Build Production Frontend Bundle
cd D:\Fire_Flies\frontend
pnpm build
```
