# Hospital Follow-up System (FUCS)

# Backend Security, Privacy, Medical Safety & Regulatory Alignment Guidelines

**Document type:** Developer security handoff and remediation baseline\
**Project:** Hospital patient registration and follow-up coordination
MVP\
**Audience:** Backend developer, frontend developer, technical lead,
QA/security tester, hospital IT, clinical/privacy reviewers\
**Status:** Engineering baseline for implementation and review --- not a
legal opinion, certification, or proof of production readiness\
**Prepared:** 29 October 2026\
**Version:** 1.0

------------------------------------------------------------------------

## 1. Purpose and how to use this document

This document sets the minimum security, privacy, medical-safety, and
secure-development rules the backend must follow. It applies to API
endpoints, database access, authentication, file uploads/scans,
background jobs, notifications, audit trails, AI/model integrations,
deployment, and operational support.

The developer must:

1.  Review the existing code against every applicable requirement below.
2.  Mark each item **Pass / Fail / Not implemented / Not applicable**,
    with evidence (test, code path, configuration, or documented
    rationale).
3.  Fix all critical and high-risk failures before any deployment
    containing real patient data.
4.  Add automated regression tests for security-critical workflows.
5.  Keep an explicit list of unresolved product, hospital-policy,
    privacy, and legal decisions. Do not silently invent answers.
6.  Obtain security, hospital IT, clinical-governance, and privacy/legal
    sign-off before a real-patient pilot.

### 1.1 Requirement language

-   **MUST**: non-negotiable project requirement unless a documented,
    approved exception is recorded.
-   **SHOULD**: strong recommendation; deviations require rationale and
    risk acceptance.
-   **LEGAL REVIEW**: applicability, commencement, or interpretation
    must be confirmed by qualified Indian counsel/privacy personnel.
    This document does not itself establish compliance.
-   **PROJECT RULE**: a safeguard chosen for this product even if it is
    not phrased as a direct statutory requirement.

### 1.2 The baseline to target

Use these as the main reference points:

-   **OWASP ASVS 5.0.0, Level 2 as the default verification target**,
    with extra controls selected for medical information and sensitive
    workflows. Consider selected Level 3 controls where the risk
    assessment warrants them. ASVS is a verifiable security-requirements
    framework, not a certification by itself.
-   **OWASP API Security Top 10 (2023)** for API-specific risks,
    especially broken object-level authorization (BOLA), broken
    authentication, property-level authorization/mass assignment,
    resource exhaustion, broken function-level authorization, SSRF,
    misconfiguration, inventory gaps, and unsafe API consumption.
-   **CERT-In Directions under section 70B of the Information Technology
    Act**, where applicable to the hospital/operator/service provider.
-   **India's Digital Personal Data Protection (DPDP) Act, 2023 and DPDP
    Rules, 2025**, with their phased commencement and current
    amendments/corrigenda checked before launch.
-   **MoHFW Electronic Health Record (EHR) Standards for India, 2016**,
    as a health-information interoperability and record-handling
    reference where applicable.
-   **WHO digital-health cybersecurity/privacy assessment guidance** as
    a risk-management aid, not Indian law.

Official links are listed in Section 19. Recheck the latest version and
legal status at the time of implementation and deployment.

------------------------------------------------------------------------

## 2. Product-specific security and patient-safety boundaries

The application is a follow-up coordination tool, not a general-purpose
EHR and not a clinical decision engine.

The backend must preserve these rules:

1.  **No AI clinical decisions.** AI may assist with document
    extraction, uncertainty flags, administrative classification,
    summaries, and operational analysis. It must not diagnose,
    prescribe, determine clinical urgency, create clinical instructions,
    or independently approve/decline/reschedule care.
2.  **Human accountability is explicit.** Identity confirmation,
    clinical interpretation, approvals, and clinical disposition remain
    with the designated human role.
3.  **No bypass around approval.** Submitted follow-up data and active
    reminder schedules must not be changed directly by a role that lacks
    approval authority.
4.  **No unrestricted IT administrator access.** IT Admin manages
    accounts and infrastructure; it does not get routine permission to
    read or alter clinical records. Exceptional access must be narrowly
    scoped, requested by an authorised Department Head, time-limited
    where feasible, reasoned, and audited.
5.  **Coordinator access is assignment-scoped.** A Follow-up Coordinator
    can see the activity needed for their assigned task and permanent
    read-only history for follow-ups they personally handled. This does
    not grant broad access to all appointments belonging to the same
    patient.
6.  **Follow-up Head sees operational metrics, not unrestricted clinical
    detail.** Additional clinical details must be requested through the
    approved assistant → doctor chain.
7.  **Reception collects minimum necessary information.** Contact
    methods, verification status, and shared-contact status are
    sensitive operational data. Do not reveal clinical details to a
    person merely because their phone number appears on the patient
    profile.
8.  **Simulation is labelled truthfully.** The MVP does not send real
    SMS/WhatsApp messages or initiate real calls. A manual "Sent"
    confirmation is not proof of provider delivery. Store it as a
    manually confirmed/simulated action.
9.  **Records are versioned and attributable.** Submitted data,
    approvals, assignment changes, and schedule changes must preserve
    who did what, when, why, and which version was affected.
10. **Synthetic data by default.** Development, demonstrations, tests,
    screenshots, sample logs, and AI experiments must use synthetic or
    properly de-identified data unless a formally approved environment
    and processing basis permit real data.

------------------------------------------------------------------------

## 3. Immediate code-review priorities: look for these blunders first

No source-code repository was supplied for this review, so this document
does **not** claim that any particular vulnerability already exists. The
following are high-risk failure modes to actively inspect and prove
absent.

### 3.1 Authorization and data exposure

-   [ ] Any endpoint accepts a patient ID, follow-up ID, scan ID,
    document ID, correction ID, query ID, or job ID and returns the
    object without checking the current user's access to that specific
    object.
-   [ ] Authorization relies on a hidden frontend button, route guard,
    or UI filter.
-   [ ] Any generic `PATCH`/`PUT` endpoint accepts arbitrary model
    fields or ORM objects from request JSON.
-   [ ] A user can change protected fields such as `role`,
    `department_id`, `approved_by`, `submitted_by`, `patient_id`,
    `status`, `severity`, `appointment_date`, `is_approved`, `is_admin`,
    or schedule version by including them in a payload.
-   [ ] A coordinator can enumerate patient records or view tasks
    assigned to other coordinators by changing an ID.
-   [ ] A Department Head can approve a record outside their authorised
    department.
-   [ ] An IT Admin can edit clinical content merely because they can
    manage users.
-   [ ] API responses expose more patient fields than the screen/task
    needs.
-   [ ] Search endpoints reveal whether a patient exists to unauthorised
    users or allow unrestricted bulk enumeration.

### 3.2 Authentication and sessions

-   [ ] Shared/default accounts, predictable passwords, permanent
    temporary passwords, or plaintext passwords.
-   [ ] Passwords stored with reversible encryption or fast hashes
    (MD5/SHA-1/plain SHA-256).
-   [ ] No brute-force protection, weak session expiry, or no forced
    invalidation after deactivation/password reset.
-   [ ] JWTs accepted without strict
    signature/algorithm/issuer/audience/expiry checks, or stored in
    unsafe browser storage without a threat-modelled reason.
-   [ ] Password-reset or temporary-password flows reveal whether an
    account exists.
-   [ ] MFA omitted for privileged accounts without an explicit,
    approved risk decision.

### 3.3 Record integrity, approvals, and background jobs

-   [ ] Approval writes a new version in a separate transaction from the
    approval decision, allowing one to succeed without the other.
-   [ ] An approval applies a proposal based on a stale record version.
-   [ ] Rejected/unapproved corrections alter the live record or
    reminder jobs.
-   [ ] Rescheduling fails to cancel old unsent jobs, or old jobs
    execute after a restart.
-   [ ] Duplicate worker execution sends/records the same action twice.
-   [ ] A patient confirmation accidentally pauses reminders despite the
    product rule that confirmation alone does not pause them.
-   [ ] A follow-up marked complete continues to generate jobs.
-   [ ] Clinical/operational status can be changed by arbitrary state
    strings.
-   [ ] Audit history can be edited or deleted through ordinary
    application endpoints.

### 3.4 Files, logs, and deployment

-   [ ] Uploaded scans are served from a public/static directory or
    accessed through guessable permanent URLs.
-   [ ] File upload trusts extension or client-supplied MIME type
    without checking file content.
-   [ ] Raw scans, patient names, phone numbers, clinical notes, tokens,
    passwords, or secrets appear in ordinary application logs.
-   [ ] Production uses debug mode, permissive CORS, default
    credentials, public database ports, or committed secrets.
-   [ ] Backups, error traces, developer dumps, analytics, or crash
    reports contain unprotected patient data.
-   [ ] No tested restoration procedure exists before real patient data
    is used.
-   [ ] Dependencies, containers, or CI pipelines can be modified by
    untrusted pull requests without controls.

Every failed check must become a tracked issue with severity, owner,
fix, and regression test.

------------------------------------------------------------------------

## 4. Threat model: what we are protecting against

### 4.1 Assets

-   Patient identity and contact details.
-   Follow-up records, severity, appointment dates, notes, and
    instructions.
-   Original scanned doctor forms and correction evidence.
-   Contact verification/shared-contact flags and contact preferences.
-   Reminder schedule versions, jobs, outcomes, and assignment history.
-   Queries, replies, internal notes, and notifications.
-   User accounts, credentials, sessions, roles, and department
    membership.
-   Audit events, backups, encryption keys, API keys, and deployment
    secrets.
-   AI prompts, datasets, model artifacts, evaluation results, and
    feedback examples.

### 4.2 Threat actors and accidental threats

Consider malicious outsiders, credential-stuffing attackers, malicious
or compromised insiders, curious staff exceeding their duties, a
compromised developer account, malicious files, prompt injection
embedded in scanned documents, misconfigured cloud storage, compromised
third-party dependencies, and ordinary mistakes such as selecting the
wrong patient or sending information to a shared phone.

### 4.3 Security goals

-   **Confidentiality:** only authorised users see the minimum necessary
    information.
-   **Integrity:** records, approvals, schedules, and audit trails
    cannot be silently altered or confused.
-   **Availability:** the system and queued work remain recoverable;
    failures are visible and do not silently lose follow-ups.
-   **Accountability:** every meaningful action is attributable to an
    individual account.
-   **Patient safety:** uncertain identity, conflicting corrections,
    missing clinical authority, and failed critical workflow steps are
    surfaced to a human rather than guessed through.
-   **Privacy:** collect, use, share, retain, and disclose personal data
    only for approved purposes and under the applicable lawful basis and
    hospital policy.

Maintain a simple threat model and update it when new roles,
integrations, AI services, messaging providers, or production
infrastructure are introduced.

------------------------------------------------------------------------

## 5. Authentication and account lifecycle

### 5.1 Individual accounts

-   MUST give each human a unique, permanent account ID. Never reuse an
    ID for another person.
-   MUST prohibit shared accounts, generic staff logins, and shared
    passwords.
-   MUST hash passwords using a modern password-hashing algorithm such
    as Argon2id, scrypt, or appropriately configured bcrypt. Use a
    well-maintained library; never design a custom password scheme.
-   MUST enforce first-login password change for temporary credentials.
-   MUST make temporary credentials random, single-user, short-lived,
    and unusable after first successful change or expiry. Prefer a
    one-time reset link or forced-reset flow over sending a reusable
    password in plain text.
-   MUST not store passwords or reset tokens in logs.
-   SHOULD check new passwords against common/breached-password lists
    and allow long passphrases. Avoid arbitrary frequent rotation unless
    compromise or policy requires it.
-   MUST rate-limit login, reset, and verification endpoints; add
    progressive delays and monitoring. Avoid controls that enable easy
    denial of service against a known user.
-   MUST provide generic authentication/reset errors that do not
    disclose account existence.
-   MUST invalidate active sessions and refresh tokens on account
    deactivation, credential reset, role/department change where access
    changes, and suspected compromise.
-   MUST ensure deactivated accounts cannot log in or act through
    existing sessions/tokens.
-   MUST preserve past attribution for deactivated accounts.

### 5.2 Multi-factor authentication

-   MUST require MFA for IT Admin and other highly privileged accounts
    before any real-patient pilot.
-   SHOULD require MFA for doctors, Department Heads, Follow-up Heads,
    and any account able to approve clinical/operational changes.
-   Prefer phishing-resistant methods such as passkeys/WebAuthn where
    practical; otherwise use a well-implemented authenticator-based
    factor. SMS OTP alone is a weaker choice.
-   Protect MFA enrollment, recovery, reset, and removal with
    re-authentication and audit events.
-   Do not let helpdesk/admin staff silently disable MFA without a
    recorded, authorised recovery process.

### 5.3 Session management

-   Prefer secure server-managed sessions in `HttpOnly`, `Secure`,
    appropriately `SameSite` cookies for a browser application, with
    CSRF protection for cookie-authenticated state-changing requests.
-   If using bearer tokens, define short access-token lifetime,
    refresh-token rotation/revocation, storage, issuer/audience
    validation, signing-key rotation, and logout semantics. Do not treat
    a JWT as safe merely because it is signed.
-   Use TLS only; never accept credentials or session tokens over plain
    HTTP in production.
-   Set idle and absolute session timeouts appropriate to hospital risk
    and usability. Re-authenticate for especially sensitive actions
    (role changes, approval, privileged access, MFA reset).
-   Protect against session fixation; rotate the session ID after login
    and privilege changes.
-   Do not place bearer tokens in URLs, query strings, analytics events,
    or error messages.
-   Configure secure cookie flags and a restrictive Content Security
    Policy for the frontend; use CSRF tokens when applicable.

------------------------------------------------------------------------

## 6. Authorization: enforce permissions in the backend

### 6.1 Central policy, deny by default

-   Implement authorization in a central policy/service layer and
    enforce it on every request, including background jobs and internal
    service calls.
-   Deny by default. A missing role/department/assignment rule must
    result in denial, not a permissive fallback.
-   Do not rely only on role names. Check role **plus** department
    scope, task assignment, record ownership/context, current status,
    and requested action.
-   Make authorization decisions on the server using the authenticated
    account, not client-supplied `user_id`, `role`, `department_id`, or
    `is_admin` fields.
-   Separate authentication ("who are you?") from authorization ("may
    you do this to this record now?").

### 6.2 Project-specific access matrix

Treat this as a minimum intended policy; implement exact endpoint-level
permissions and tests. Where product rules remain unresolved, deny the
risky action until the owner decides.

  ------------------------------------------------------------------------
  Role                    Minimum permitted scope  Must not be able to do
  ----------------------- ------------------------ -----------------------
  Reception               Register patient; search Read clinical notes by
                          for duplicate candidates default; directly edit
                          in the registration      a submitted patient
                          workflow; verify/mark    profile; approve their
                          contact details; submit  own correction
                          demographic-correction   
                          requests                 

  Doctor's Assistant      Patients/follow-ups      Directly edit submitted
                          within authorised        record; approve own
                          departmental scope;      change; bypass
                          prepare/submit records;  Department Head
                          edit own drafts; propose approval
                          corrections/schedule     
                          changes; receive and     
                          forward linked queries   

  Doctor                  Records they are         Directly overwrite
                          authorised to view in    submitted record or
                          their                    bypass required
                          department/clinical      approval
                          relationship; request    
                          corrections; provide     
                          clinical decisions       
                          through defined workflow 

  Department Head         Review/approve/reject    Approve outside scope;
                          correction and           silently alter history;
                          schedule-change requests approve stale proposals
                          within authorised scope; without revalidation
                          see supporting evidence  
                          required for the         
                          decision                 

  Follow-up Coordinator   Only assigned follow-up  Browse all patients;
                          task context and         access unassigned
                          activity they personally tasks; make clinical
                          handled; record manual   decisions; directly
                          outcomes and queries     edit clinical record or
                                                   independently close
                                                   declined follow-up

  Follow-up Head          Coordinator workload,    Unrestricted access to
                          assignments, operational clinical notes or
                          statuses, priority tasks patient-wide history;
                          and metrics; request     make clinical decisions
                          clinical detail through  
                          approved chain           

  IT Admin                Account lifecycle,       Routine access to
                          system configuration and clinical data or
                          technical operations     independent
                                                   clinical/operational
                                                   record changes

  Background              Only the specific        Interactive login,
  worker/service identity database/storage/queue   broad admin privileges,
                          permissions needed for   or arbitrary clinical
                          its job                  updates
  ------------------------------------------------------------------------

### 6.3 Object-level authorization / BOLA

For every endpoint receiving an object ID, query the object through an
access-scoped query or verify authorization before returning or changing
it. Examples include `/patients/{id}`, `/followups/{id}`, `/scans/{id}`,
`/corrections/{id}`, `/queries/{id}`, `/reminders/{job_id}`,
`/contacts/{id}`, and audit events.

-   A random/UUID identifier is helpful but **not authorization**.
-   Avoid fetching an unrestricted object and hoping the UI hides it.
-   Return a consistent denial/not-found response where appropriate to
    avoid revealing the existence of sensitive records.
-   Apply the same policy to exports, downloads, search results,
    notifications, websocket/SSE events, background tasks, and internal
    links.
-   Test horizontal access (one user accessing another user's records)
    and vertical access (lower privilege calling a privileged endpoint).

### 6.4 Property-level authorization and mass assignment

-   Use explicit request/response schemas and allowlists. Never bind
    arbitrary JSON directly to a database model.
-   Use separate schemas for draft edits, correction proposals,
    approvals, and account administration.
-   Server-generate protected values: IDs, actor IDs, timestamps,
    approval state, audit metadata, schedule versions, and status
    transitions.
-   Reject or ignore forbidden fields; preferably reject requests
    containing protected fields so client bugs are visible.
-   Do not expose hidden fields merely because they exist on an ORM
    object.
-   Ensure a coordinator cannot submit `{"role":"admin"}`, an assistant
    cannot submit `{"approved":true}`, and a client cannot set
    `created_by` to another user.

### 6.5 Department and assignment boundaries

-   Check department membership at the time of each request; do not
    trust stale department information in a long-lived token alone.
-   Multi-department membership remains an open product decision. Model
    membership explicitly so it can be constrained, rather than assuming
    all users belong to every department.
-   A doctor correction request must route through the linked assistant
    workflow. If that assistant is unavailable, do not silently reroute;
    use the product owner's approved fallback rule.
-   Reassignment to another coordinator requires Follow-up Head
    authorization as defined by product rules. Do not automatically
    reassign a deactivated coordinator's task without recording the
    required approval.
-   Priority assignment must remain distinct from clinical severity. Log
    the reason, assigning Follow-up Head, selected coordinator, workload
    warning, and outcome.

------------------------------------------------------------------------

## 7. Record integrity, approvals, and clinical workflow safety

### 7.1 Explicit domain actions

Use domain-specific endpoints/services such as `submit_followup`,
`request_correction`, `approve_correction`, `reject_correction`,
`propose_schedule_change`, `approve_schedule_change`,
`complete_followup`, and `authorise_reassignment`.

Do not create a generic endpoint that lets a user update any field on a
submitted record. Every transition must validate actor, current state,
object scope, allowed transition, required evidence, and current record
version.

### 7.2 Immutable versions and approval transaction

-   Drafts may be edited by the permitted authoring role. Once
    submitted, treat the submitted version as immutable.
-   A correction request must record its own ID, requester, reason,
    proposed field changes, evidence references, base record version,
    timestamps, and status.
-   On approval, re-check the approver's authority, the request status,
    and that the current record version still matches the proposal's
    base version.
-   Apply approval decision, new record version, audit event, and
    affected schedule changes in a single database transaction or a
    reliable transactional/outbox pattern.
-   If the version changed, mark the proposal stale/conflicted and
    require renewed review. Never apply an outdated proposal silently.
-   A rejected request must not alter active data or active reminder
    jobs.
-   Preserve previous values and provenance. Do not overwrite the only
    copy of a submitted record.
-   Record the actual approving user ID; never accept `approved_by` from
    client input.
-   Consider a two-person rule for particularly high-impact changes if
    hospital clinical governance requires it.

### 7.3 Separation of duties

-   A requester must not approve their own correction or schedule change
    unless an explicit, documented hospital policy authorises that
    exception.
-   IT Admin must not use technical privilege to bypass clinical
    approval.
-   The approval UI/API must show old values, proposed values, reason,
    evidence, base version, and likely downstream impact.
-   Approval must be an explicit action, not a side effect of opening a
    page or saving a draft.
-   High-impact decisions must require a deliberate confirmation and
    audit the reason/comment where policy requires it.

### 7.4 Patient identity and contact handling

-   Search for possible duplicates before creating a patient.
-   Use stable internal patient IDs; do not use a patient's name as the
    key.
-   Confirm sufficient identity attributes (for example, DOB and other
    hospital-approved identifiers) before associating a follow-up with a
    patient. If ambiguous, stop and ask an authorised human.
-   Do not merge records automatically. A duplicate merge is a
    high-impact identity operation and requires an approved workflow,
    provenance, and a recovery plan.
-   Store contact verification status, method, time, verifier,
    shared-contact flag, and any relevant preferences as distinct fields
    with controlled transitions.
-   Do not disclose diagnosis, clinical instructions, severity, or
    appointment details to a shared/alternate number unless the hospital
    has approved a lawful, consent-aware contact protocol and the
    recipient's authority has been checked.
-   Keep contact preferences/opt-outs and consent records auditable. Do
    not interpret a verified phone number as consent to disclose health
    information.
-   The approved script for calls/messages and rules for family
    members/caregivers require hospital sign-off before real
    communications are enabled.

### 7.5 Clinical uncertainty and human review

-   If patient identity, form extraction, date, severity, clinical
    instruction, or record linkage is uncertain, show the uncertainty
    and require human review.
-   OCR/AI output is a proposal, not a source of truth. Preserve the
    original scan and a record of human-edited fields.
-   Never let AI infer missing appointment dates, fabricate clinical
    instructions, or "correct" a doctor's handwriting without human
    verification.
-   Do not silently suppress a follow-up because of missing contact
    details, a patient response, or an AI classification.
-   When a workflow failure could affect care, create a visible
    task/alert with a responsible human owner and escalation path. Do
    not claim the system guarantees care or prevents missed
    appointments.

------------------------------------------------------------------------

## 8. API security and input validation

### 8.1 API design

-   Use HTTPS and a versioned API namespace.
-   Publish an inventory of all routes, methods, request/response
    schemas, authentication requirements, role permissions, rate limits,
    and data classifications.
-   Disable or protect interactive API documentation/OpenAPI endpoints
    in production if they expose internal operational detail; public
    docs must not reveal secrets or sensitive schemas.
-   Return only the fields required for the current task.
-   Use pagination, maximum page sizes, filters, and result caps for
    list/search endpoints.
-   Avoid overly detailed error responses. Do not return stack traces,
    SQL, file paths, secrets, or internal configuration.
-   Use a consistent error schema with a request/correlation ID; keep
    detailed diagnostics in protected logs.
-   Apply rate limits by account, IP/network signals, and endpoint risk,
    with appropriate limits for search, login, uploads, OCR, exports,
    and expensive jobs.
-   Use idempotency keys or unique constraints for operations that must
    not duplicate (submissions, approvals, job creation, simulated send
    confirmations, provider callbacks if added).
-   Do not use GET for state-changing actions.
-   Validate content type, size, structure, field lengths, numeric
    bounds, date ranges, enum values, and cross-field business rules on
    the server.
-   Use parameterized database queries/ORM-safe APIs. Do not build SQL
    by concatenating user input.
-   Normalize input consistently; validate before business logic. Encode
    output contextually in the frontend.
-   CORS must allow only explicitly approved origins. CORS is not
    authentication.
-   Disable unnecessary methods, headers, debug endpoints, and unused
    routes.

### 8.2 Specific business validations

At minimum, enforce server-side validation for:

-   Follow-up-required = `true` requires a valid appointment date.
-   Follow-up-required = `false` creates no reminder schedule or jobs.
-   Appointment date, severity, instructions, and follow-up state can
    change only through allowed workflow transitions.
-   Dates are interpreted in an explicitly configured hospital timezone;
    unresolved timezone/daytime-window rules must not be guessed for
    production.
-   An approval references a valid pending request and the expected
    record version.
-   A reminder job belongs to the expected follow-up and schedule
    version.
-   Completion cancels remaining unsent jobs for that follow-up cycle.
-   Rescheduling preserves old schedule history and cancels old unsent
    jobs.
-   Overdue reminders follow the approved rule (currently +2 days and +4
    days after missed appointment, then stop).
-   A manual "Sent" action is recorded as simulated/manual confirmation,
    never as provider-verified delivery.
-   User-supplied state names cannot jump directly to privileged states
    such as approved, completed, cancelled, or reassigned.

### 8.3 Rate limiting and resource exhaustion

-   Set maximum request body, upload size, page size, OCR runtime, image
    dimensions, queue depth, and job retry budgets.
-   Limit repeated expensive scan processing and avoid unbounded
    synchronous OCR inside an API request.
-   Add per-user/per-endpoint quotas and monitoring for enumeration or
    abusive traffic.
-   Ensure retries use bounded backoff and cannot create infinite retry
    loops.
-   Use timeouts and resource limits for external APIs and document
    processing.
-   Avoid unbounded regular expressions and other CPU-expensive input
    validation.

### 8.4 SSRF and external integrations

If the backend fetches any user-provided URL or calls external services:

-   Prefer fixed, allowlisted destinations and official SDKs.
-   Block access to loopback, private network ranges, link-local
    addresses, cloud metadata endpoints, and internal administrative
    hosts.
-   Validate redirects and DNS resolution; do not validate only the
    initial URL.
-   Apply network egress restrictions, timeouts, response-size limits,
    and content-type validation.
-   Never allow a scanned document or model output to direct arbitrary
    server-side network requests.
-   Keep external provider credentials server-side and scoped to the
    minimum privileges.

------------------------------------------------------------------------

## 9. File upload, scanned forms, and evidence security

Original doctor forms and correction evidence are sensitive medical
records.

### 9.1 Upload controls

-   Accept only explicitly required file formats; allowlist extensions
    and verify actual content using file signatures/MIME inspection.
-   Set strict file-size, page-count, image-dimension, and
    processing-time limits.
-   Generate a random server-side storage name; never use the original
    filename as a path.
-   Store files outside the web root or in private object storage. No
    public bucket, public static directory, or permanent public URL.
-   Store file metadata separately: uploader ID, time, associated
    patient/follow-up, file hash, detected type, scan status, and
    retention classification.
-   Scan files for malware where practical; quarantine before processing
    if needed.
-   Re-encode images where appropriate; safely process PDFs and images
    in a restricted worker/container with minimal filesystem/network
    privileges.
-   Treat PDFs and images as hostile input. Patch parsers and image
    libraries.
-   Do not execute uploaded files, macros, embedded scripts, or active
    content.
-   Do not trust client-supplied filenames, MIME types, or document
    metadata.

### 9.2 Download controls

-   Authenticate and authorize each file download against the linked
    patient/follow-up and current user's scope.
-   Prefer short-lived signed download URLs only after server-side
    authorization; use very short expirations and avoid URLs in logs.
-   Set safe `Content-Disposition` and
    `X-Content-Type-Options: nosniff`; serve risky content as download
    rather than inline where feasible.
-   Prevent path traversal and symlink attacks.
-   Audit sensitive downloads, bulk exports, and failed access attempts.
-   Never expose evidence to all users simply because they can view a
    correction request's status.

### 9.3 Provenance and integrity

-   Preserve the original scan unmodified when product requirements
    require it.
-   Store a cryptographic hash (e.g., SHA-256) to detect unexpected
    alteration; a hash is an integrity check, not encryption.
-   Keep derived OCR text/extracted values distinct from the original
    source document.
-   Record which fields were machine-extracted, confidence/uncertainty
    where available, and which were reviewed/changed by a human.
-   Do not put OCR text or medical document contents into third-party
    analytics or generic error reporting.

------------------------------------------------------------------------

## 10. Database, secrets, cryptography, and environment security

### 10.1 Database

-   Keep the database on a private network; never expose its port to the
    public internet.
-   Use separate database roles for migrations, application runtime,
    background workers, reporting, and backups where practical.
-   The runtime role must not be a database superuser and should have
    only necessary table/schema privileges.
-   Use parameterized queries and transaction boundaries; enforce
    important invariants with database constraints as well as
    service-layer checks.
-   Use migrations under review and test rollback/forward recovery.
-   Add indexes and query limits to avoid accidental resource
    exhaustion.
-   Do not let application users query the database directly.
-   Do not rely on database row-level security unless it is configured,
    tested, and used consistently; application authorization is still
    required.
-   Protect connection strings and credentials with a secret
    manager/environment injection, not source files.

### 10.2 Encryption

-   Use modern TLS for all network traffic, including reverse proxy →
    app, app → database, storage, and third-party connections where
    supported.
-   Encrypt database volumes, backups, document storage, and portable
    exports at rest.
-   Use managed key storage/KMS where available; separate keys from
    encrypted data and limit key access.
-   Define key rotation, revocation, recovery, and ownership.
-   Do not invent custom cryptography. Use maintained libraries and
    authenticated encryption where application-level encryption is
    needed.
-   Consider field-level encryption only where a clear threat model and
    key-management design justify it; encryption at rest does not
    replace access control.
-   Never commit private keys, API keys, JWT signing secrets, database
    passwords, encryption keys, or production `.env` files to Git.

### 10.3 Environment separation

Maintain separate development, test, staging, and production
environments, credentials, databases, buckets, API keys, and encryption
keys. Never copy production data into development without an approved,
secure de-identification process.

-   Production secrets must not be available to untrusted pull requests
    or forked CI jobs.
-   Use least-privilege service accounts and short-lived credentials
    where possible.
-   Restrict administrative consoles, SSH, database management, and
    deployment access.
-   Disable debug mode and development reloaders in production.
-   Configure security headers, secure cookies, restrictive CORS,
    trusted proxy settings, and host validation.
-   Pin or lock dependencies; review upgrades and remove unused
    packages.
-   Use infrastructure-as-code and reviewed changes for
    security-sensitive configuration.

------------------------------------------------------------------------

## 11. Audit logs, monitoring, and incident response

### 11.1 What to audit

Create append-only application audit events for at least:

-   Login successes/failures, logout, password reset, MFA changes,
    account deactivation/reactivation, role/department changes.
-   Patient registration and demographic-correction requests/decisions.
-   Sensitive patient/follow-up views and file downloads where
    proportionate and approved.
-   Follow-up creation, submission, version changes, correction
    requests, approvals/rejections, and stale/conflicting proposals.
-   Schedule creation/change/approval, job cancellation, retry review,
    completion, cancellation, superseding, and overdue transitions.
-   Coordinator assignment/reassignment, priority assignment, workload
    override, and Follow-up Head actions.
-   Contact verification/preferences/opt-out changes and manual
    communication confirmations/outcomes.
-   IT Admin exceptional access requests and approved interventions.
-   Security-relevant configuration changes, exports, audit access, and
    privileged operations.
-   AI dataset creation, data export to a model provider,
    training/evaluation runs, model release/rollback, and human approval
    of model changes if these features are added.

Each event should include: event ID, UTC timestamp, actor user ID or
service identity, action, object type and ID, outcome, reason where
appropriate, request/correlation ID, and relevant version IDs. Capture
before/after values only where needed and permitted; redact sensitive
content.

### 11.2 Log integrity and privacy

-   Application roles must not be able to modify/delete audit events
    through ordinary APIs.
-   Restrict log access separately from clinical access.
-   Protect logs from tampering; use centralised/append-only storage or
    equivalent controls appropriate to the deployment.
-   Do not log passwords, reset tokens, access/refresh tokens, API keys,
    full contact details, raw clinical notes, full OCR text, or full
    request bodies by default.
-   Use patient IDs or pseudonymous references only where operationally
    necessary, with careful access controls.
-   Sanitize untrusted log fields to prevent log injection.
-   Keep security logs and clinical record history conceptually
    distinct: neither substitutes for the other.
-   Set retention based on applicable law, hospital policy, incident
    needs, and data minimization. Do not invent an arbitrary deletion
    period.

### 11.3 Monitoring and response

-   Alert on repeated login failures, unusual patient searches, bulk
    downloads, access-denied spikes, role changes, audit-log access,
    queue backlog, failed scheduled jobs, and unexpected data exports.
-   Maintain an incident-response plan with named owners, severity
    levels, containment steps, evidence preservation, communication
    paths, and recovery procedures.
-   Preserve logs and evidence before destructive remediation where
    safe.
-   Establish who assesses patient-safety impact when a security
    incident disrupts follow-up tasks or may expose/change records.
-   Review incidents and near misses; create remediation tasks and
    regression tests.
-   Verify the currently applicable CERT-In reporting deadline and
    process with the hospital's legal/security lead. CERT-In Directions
    have required reporting of specified cyber incidents within six
    hours of noticing them or being informed, and secure maintenance of
    ICT logs for a rolling 180 days within Indian jurisdiction for
    covered entities; applicability and current requirements must be
    confirmed for the actual operator/provider.
-   Do not assume a vendor will report an incident on the hospital's
    behalf unless the contract and process explicitly say so.

------------------------------------------------------------------------

## 12. Background jobs, reminder reliability, and concurrency

Reminder jobs are safety-relevant operational work. A security control
that loses, duplicates, or silently changes them is not sufficient.

-   Use a durable database-backed queue or task system; do not rely on
    in-memory timers for production-like behavior.
-   Give each job a stable ID, follow-up ID, schedule version, intended
    action/time, status, attempt count, and timestamps.
-   Make job handlers idempotent. Re-running a job must not create
    duplicate records or falsely report success.
-   Enforce bounded retries and backoff; current product direction caps
    attempts at three total per scheduled reminder, but retry timing
    still requires an approved decision.
-   Use a transactional outbox or equivalent so a committed schedule
    change and queued work cannot diverge silently.
-   On reschedule, cancel unsent jobs from the old schedule version,
    preserve history, and create a new version.
-   Before executing a job, re-check that the follow-up is still active,
    the schedule version is current, the job has not been cancelled, and
    the action remains permitted.
-   Prevent two workers from processing the same job concurrently using
    atomic claiming/locking or an equivalent safe mechanism.
-   Record retry exhaustion and create a visible human-review task when
    required; do not silently drop failures.
-   Monitor queue age, worker health, failed jobs, and overdue work.
-   Timezone and permitted contact hours are unresolved product/hospital
    decisions. Do not guess them for production.
-   The MVP's manual "Sent" action must be represented as
    simulation/manual confirmation, not provider delivery. Real
    SMS/calls require a separate provider, consent, privacy,
    reliability, and security review.

------------------------------------------------------------------------

## 13. Privacy and medical-information handling

### 13.1 Data minimisation and purpose limitation

-   Collect only data needed for registration, follow-up coordination,
    safety, accountability, and approved operations.
-   Document the purpose and lawful basis for each data category and
    workflow with the hospital/privacy lead.
-   Avoid collecting national identifiers or extra demographic details
    unless the hospital has an approved need and secure process.
-   Do not use patient data for unrelated analytics, advertising, model
    training, demos, or developer convenience.
-   Define a data inventory: field, purpose, source, user roles allowed,
    storage location, external recipients, retention rule, and
    deletion/archive process.
-   Make privacy notices understandable and specific to the real
    processing; do not rely on a generic "we value privacy" banner.

### 13.2 Consent, authority, and communications

-   Do not treat a verified contact method as consent to disclose
    medical information.
-   Define the hospital-approved lawful basis, consent/notice
    requirements, patient/caregiver authority, contact preferences,
    withdrawal handling, and emergency exceptions with legal/privacy and
    clinical governance.
-   Keep the content of reminders minimal. Do not include diagnoses,
    test results, treatment instructions, or sensitive detail in a
    message to a shared number unless specifically authorised by policy
    and the recipient is appropriately verified.
-   Do not store raw call recordings or raw message archives in the MVP;
    this is a stated product boundary.
-   Coordinator notes should be factual, necessary, professional, and
    relevant. Provide training and a clear policy against speculative,
    insulting, or unrelated personal notes.
-   Do not reveal patient existence or clinical details through
    notification previews, lock-screen notifications, email subject
    lines, URL parameters, or browser titles. Notifications should say
    that an authorised action is pending and link to the protected app.

### 13.3 Access, correction, retention, and deletion

-   Support a governed process to correct inaccurate personal data while
    preserving a traceable history.
-   Do not physically delete medical/audit records just because a user
    account is deactivated.
-   Define retention, archival, legal hold, deletion, backup expiry, and
    access-request processes with the hospital and counsel. The final
    policy is currently unresolved; do not hard-code an arbitrary
    period.
-   When deletion or de-identification is authorised, include copies,
    object storage, derived datasets, exports, and backups according to
    the approved policy.
-   Do not promise a patient a deletion outcome that conflicts with
    applicable medical-record retention duties; route requests to the
    responsible hospital role.

### 13.4 Privacy impact and access reviews

-   Conduct and document a privacy impact/risk assessment before real
    patient data is loaded.
-   Review role assignments and department memberships periodically and
    whenever staff change roles or leave.
-   Keep a vendor/data-flow register for hosting, email, monitoring,
    OCR, analytics, backups, and AI/model providers.
-   Record cross-border processing and subprocessors; do not assume that
    a provider's marketing statements establish legal compliance.
-   Define a process for privacy complaints, access/correction requests,
    consent withdrawal where applicable, and incident notification.

------------------------------------------------------------------------

## 14. India-specific regulatory and standards checklist

This section is a planning checklist, not a legal conclusion.
Applicability depends on the hospital/operator, deployment model, data
flows, intended use, and current commencement notifications.

### 14.1 DPDP Act, 2023 and DPDP Rules, 2025

-   Review the Act, final Rules, corrigenda, and official enforcement
    timeline---not just the earlier draft Rules.
-   The November 2025 commencement notification phased in provisions
    over different periods. As of this document date (29 October 2026),
    do not assume every substantive obligation has already commenced;
    the official timeline indicates that many core processing
    obligations have an 18-month commencement period from the November
    2025 notification. Confirm the exact section/rule effective dates
    with counsel.
-   Design now for clear notice, purpose-specific processing, data
    minimisation, reasonable security safeguards, breach response,
    data-principal rights workflows, processor contracts,
    retention/deletion rules, and accountability because these can
    require significant architecture changes.
-   Determine who is the Data Fiduciary and whether the hospital,
    project owner, hosting provider, or any other party acts as a Data
    Processor for each flow. Document roles contractually.
-   Do not assume consent is the only possible lawful basis or that
    healthcare use is automatically exempt. Obtain a fact-specific legal
    assessment.
-   Do not assume the system is a Significant Data Fiduciary; that
    status depends on government designation and applicable criteria.
-   Build the ability to record notices/consents where required,
    purpose, timestamps, withdrawal/changes, and handling of rights
    requests. Keep consent state separate from mere contact
    verification.
-   Confirm the actual incident-notification obligations and deadlines
    under the final law/rules and applicable CERT-In directions; these
    are separate regimes and may both matter.

Official starting points: MeitY DPDP Rules 2025 and the official
enforcement timeline are linked in Section 19.

### 14.2 IT Act, SPDI Rules, and CERT-In

-   Ask Indian counsel to assess the Information Technology Act, 2000,
    the SPDI Rules, 2011 and their interaction with the DPDP framework
    and commencement schedule.
-   Medical/health information has historically been treated as
    sensitive personal data/information under India's SPDI framework. Do
    not assume the old framework can be ignored before the relevant
    legal transition is effective.
-   Check the applicability of CERT-In Directions to the actual
    hospital, company, cloud/service providers, and system operator.
-   Where applicable, maintain secure ICT logs for the required rolling
    period and within the required jurisdiction; establish the incident
    reporting point of contact and reporting playbook.
-   Keep an incident log and evidence-preservation procedure even where
    a specific reporting rule is not applicable.

### 14.3 MoHFW EHR Standards for India

-   Review the MoHFW Electronic Health Record Standards for India (2016)
    where the system's record structure, interoperability, terminology,
    identifiers, exchange, privacy, or security requirements make them
    relevant.
-   Do not claim EHR-standard compliance just because the database
    contains patient fields.
-   If hospital/EHR/ABDM integration is added, define a formal
    interoperability and identity-matching design, approved APIs, data
    mappings, access controls, consent/authorisation model,
    auditability, and conformance tests before implementation.
-   Do not invent ABHA/ABDM integration or transmit ABHA identifiers
    unless the hospital explicitly authorises that scope and the
    integration is designed to the applicable official specifications.

### 14.4 CDSCO / Medical Device Software (MDSW)

The product is currently scoped as an administrative follow-up
coordination system, not a diagnostic or treatment-decision system. That
scope is important but does not automatically decide regulatory status.

-   Keep the software's intended purpose documented and narrow.
-   Do not add features that diagnose, recommend treatment, determine
    clinical urgency, or drive care decisions without a fresh regulatory
    and clinical safety assessment.
-   If intended use changes or the product begins making medical
    recommendations, assess applicability of the Medical Devices Rules,
    2017 and the current CDSCO Medical Device Software guidance with
    regulatory counsel/experts.
-   Do not market the tool as a certified medical device or claim CDSCO
    approval unless that status is genuinely established.

### 14.5 Contracts, hospital policy, and professional obligations

Before a real-patient pilot, obtain written approval for: hosting
location, access roles, data flows, processor/vendor agreements, privacy
notice/consent/contact policy, retention, breach response, downtime
procedures, backups, support access, clinical escalation, audit access,
and responsibility for incident handling.

------------------------------------------------------------------------

## 15. AI, OCR, and Adaption Labs security rules

AI integration is a future differentiator, not permission to send
patient data to an external service by default.

### 15.1 Data sharing and provider approval

-   Use synthetic or properly de-identified examples for prototyping and
    training until the hospital/privacy lead and counsel approve the
    data flow.
-   Before any real data is sent to Adaption Labs or another provider,
    document purpose, fields sent, legal basis, consent/notice
    implications, hosting/processing locations, retention, training use,
    subprocessors, deletion guarantees, access controls, breach terms,
    and contract terms.
-   Do not assume a vendor's API or "private" setting means patient data
    will never be retained or used for training. Verify in current
    contractual documentation.
-   Send the minimum fields needed; avoid patient names, phone numbers,
    IDs, raw scans, and clinical notes unless specifically approved and
    technically necessary.
-   Keep `ADAPTION_API_KEY` and all model credentials in server-side
    secret management. Never expose keys to the browser or commit them
    to the repository.
-   Restrict outbound network access and log which dataset/model version
    was sent, by whom, for what purpose, and under which approval.

### 15.2 Prompt injection and untrusted documents

-   Treat scanned forms, OCR output, user notes, retrieved text, and
    model output as untrusted data---not instructions to the system.
-   A document saying "ignore all rules," "send this record elsewhere,"
    or "approve this change" must not alter permissions or trigger
    actions.
-   Do not give the model database credentials, direct unrestricted
    database access, arbitrary tool execution, or the ability to approve
    records.
-   Keep tool permissions allowlisted and narrow; validate every
    model-generated structured output against a strict schema and
    business rules.
-   Never let model output directly write to the database. Route
    proposals through a human review and approved backend action.
-   Test prompt injection, malformed output, data exfiltration attempts,
    cross-patient leakage, hallucinated dates/instructions, and
    confidence calibration.

### 15.3 Controlled improvement, not ungoverned online learning

-   Do not enable silent live/online learning from patient interactions.
-   Human corrections may become candidate training examples only after
    approved review, de-identification where possible, quality checks,
    and provenance recording.
-   Keep versioned datasets and separate training/evaluation/test sets.
    Prevent patient-level leakage between train and test splits.
-   Evaluate against a fixed baseline and safety-focused test suite
    before promoting a model.
-   Require a named human to approve every model version before
    deployment; keep rollback capability.
-   Monitor extraction errors by field and document type, not only
    aggregate accuracy. Critical fields (patient identity, DOB,
    appointment date, severity, instructions) require human
    verification.
-   Record model name/version, prompt/config version, dataset version,
    evaluation result, reviewer, approval, deployment time, and rollback
    events.
-   Do not use AI to determine clinical urgency or make a care decision
    in this project.

------------------------------------------------------------------------

## 16. Secure development lifecycle and supply-chain security

### 16.1 Repository and code review

-   Require pull requests and review for security-sensitive changes.
-   Protect the main branch, require status checks, and prevent direct
    unreviewed production pushes.
-   Require review from a second person for authentication,
    authorization, approval logic, file access, secrets, migrations,
    deployment, and AI data-flow changes.
-   Keep an architecture decision record for material security
    trade-offs.
-   Use secure coding guidance and ASVS requirements as review criteria.

### 16.2 Automated pipeline

Add appropriate CI checks:

-   Formatting, type checking, unit and integration tests.
-   Static application security testing (SAST).
-   Dependency and license scanning.
-   Secret scanning (including repository history where feasible).
-   Container/image scanning if containers are used.
-   Infrastructure-as-code scanning if applicable.
-   API contract tests and authorization tests.
-   Dynamic application security testing (DAST) in a safe staging
    environment.
-   Software bill of materials (SBOM) for release artifacts where
    practical.
-   Build artifacts from trusted pipelines; sign or otherwise verify
    release provenance where feasible.

A green pipeline does not prove security. Triage findings and document
false positives rather than blindly ignoring scanner output.

### 16.3 Dependencies

-   Use supported versions, lock dependencies, and patch critical/high
    vulnerabilities promptly based on exposure.
-   Remove unused packages and tools.
-   Verify package sources and avoid typosquatting risks.
-   Do not install packages or execute scripts from untrusted model
    output.
-   Pin action/plugin versions in CI where feasible and minimise CI
    token permissions.
-   Separate test credentials from production secrets; never make
    production secrets available to untrusted PRs.

------------------------------------------------------------------------

## 17. Testing and release gates

### 17.1 Required security tests

At minimum, automate tests for:

1.  Unauthenticated requests cannot access protected APIs.
2.  Each role is denied all actions outside its policy.
3.  User A cannot access User B's
    patient/follow-up/scan/correction/query/job by swapping IDs.
4.  A coordinator cannot access unassigned tasks or another
    coordinator's history.
5.  Follow-up Head cannot read unrestricted clinical notes.
6.  IT Admin cannot alter clinical records through ordinary admin APIs.
7.  An assistant cannot edit submitted data directly.
8.  A requester cannot approve their own correction.
9.  Approval fails safely if the record version has changed.
10. Rejected/stale requests do not change live records or jobs.
11. Protected fields in request payloads are rejected.
12. Uploads reject oversized, malformed, unsupported, or malicious
    files.
13. File download requires object-level authorization and does not
    expose public storage paths.
14. Rate limits prevent brute-force and expensive endpoint abuse.
15. Deactivated accounts lose access, including through existing
    sessions/tokens.
16. Audit events are created for all high-impact actions and cannot be
    modified via normal application APIs.
17. Duplicate/retried jobs do not create duplicate actions.
18. Reschedule cancels old unsent jobs and preserves history after
    worker restart.
19. Complete/cancel/supersede transitions prevent prohibited jobs from
    running.
20. No secrets, tokens, or unnecessary patient data appear in logs.
21. CORS, CSRF, security headers, cookie flags, TLS, and production
    configuration match policy.
22. Model/OCR output cannot bypass human approval or write arbitrary
    fields.
23. Search endpoints resist enumeration and do not disclose patient
    existence to unauthorised users.
24. Backups can be restored in a test environment and access is
    restricted.

### 17.2 Testing tools and scope

Use a combination of code review, automated tests, SAST/dependency
scanning, DAST, API authorization testing, configuration review, and
manual penetration testing. Automated scans alone are insufficient.

Before a real-patient pilot, commission an independent security
assessment by a qualified assessor. If the hospital/contract/regulatory
process requires a CERT-In-empanelled auditor, use one. Scope must
include the web frontend, API, auth/session management, file storage,
cloud configuration, APIs, role/department boundaries, business logic,
and any exposed admin surfaces.

### 17.3 Severity and remediation gate

-   **Critical:** fix and retest before any deployment.
-   **High:** fix and retest before any real-patient pilot.
-   **Medium:** fix before production where practical; otherwise
    documented mitigation, owner, and deadline approved by the
    accountable risk owner.
-   **Low/informational:** track and resolve according to risk and
    maintenance policy.
-   No known critical/high issue may be waived by the developer alone.
    Risk acceptance must be explicit, written, time-limited, and
    authorised by the organisation that owns the risk.

Do not claim "passed penetration testing" without a dated report,
defined scope, tester identity/qualifications, findings, remediation
evidence, and retest results.

------------------------------------------------------------------------

## 18. Deployment, backups, resilience, and operations

### 18.1 Deployment hardening

-   Put the app behind a maintained reverse proxy/load balancer with TLS
    and safe headers.
-   Restrict network ingress and egress; expose only required ports.
-   Keep database, object storage, task queue, admin interfaces, and
    metrics endpoints private.
-   Use least-privilege OS/container identities; run services as
    non-root where feasible.
-   Keep secrets out of images and logs; rotate exposed credentials
    immediately.
-   Disable debug endpoints, sample accounts, default credentials, and
    development tools.
-   Set resource limits and health checks; keep readiness separate from
    liveness.
-   Monitor patch status, disk usage, queue health, database health,
    certificates, and error rates.
-   Keep production and staging isolated.

### 18.2 Backups and recovery

Backups and disaster recovery were previously deferred from MVP scope.
That is acceptable only for synthetic-data prototyping---not for a
real-patient pilot.

Before real data is used:

-   Define and approve backup frequency, retention, encryption, access,
    and geographic location.
-   Keep backups isolated from normal application credentials; protect
    against ransomware/deletion.
-   Back up database and protected document storage consistently.
-   Test restoration regularly and record evidence; an untested backup
    is not a recovery plan.
-   Define recovery point objective (RPO) and recovery time objective
    (RTO) with the hospital.
-   Document downtime workflow and post-recovery reconciliation so no
    follow-up is silently lost or duplicated.
-   Ensure backup deletion follows the approved retention/legal-hold
    policy.

### 18.3 Change and configuration control

-   Version security-sensitive settings and reminder rules.
-   Changes to contact hours, reminder formulas, severity ratios,
    permissions, retention, or clinical workflow must be reviewed and
    approved by the designated owner.
-   Keep configuration separate from code where appropriate, but
    validate configuration as strictly as input.
-   Log who proposed, approved, activated, and rolled back a policy.
-   Test rollback and migration recovery before deployment.

------------------------------------------------------------------------

## 19. Official references and standards

The links below are starting points for the developer and reviewers.
Confirm the current edition, exact provisions, and legal status before
relying on them.

### Application and API security

1.  **OWASP Application Security Verification Standard (ASVS), official
    project and version 5.0.0**\
    https://asvs.owasp.org/\
    Use Level 2 as the default verification target; tailor additional
    controls for health information and higher-risk workflows.

2.  **OWASP API Security Top 10 (2023)**\
    https://owasp.org/API-Security/\
    Focus on object-level authorization, authentication, property-level
    authorization/mass assignment, resource consumption, function-level
    authorization, SSRF, misconfiguration, inventory, and unsafe API
    consumption.

3.  **OWASP Cheat Sheet Series**\
    https://cheatsheetseries.owasp.org/\
    Useful implementation references include Authentication,
    Authorization, Session Management, Password Storage, File Upload,
    Logging, REST Security, CSRF Prevention, Secrets Management, and
    SSRF Prevention cheat sheets.

### India: privacy, cyber incident handling, and health records

4.  **Digital Personal Data Protection Rules, 2025 --- MeitY official
    page**\
    https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa\
    Check the final Rules, corrigenda, and official enforcement
    timeline. Do not rely on the earlier draft as the final law.

5.  **Digital Personal Data Protection Act, 2023 --- India Code /
    official government sources**\
    https://www.indiacode.nic.in/\
    Search the exact Act title and read it with the 2025 commencement
    notification and Rules.

6.  **DPDP Act commencement notification, Gazette of India, 13 November
    2025**\
    https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf\
    Establishes phased commencement; confirm the effective dates of the
    provisions relevant to the planned launch.

7.  **CERT-In Directions under section 70B, 28 April 2022 --- official
    page**\
    https://www.cert-in.org.in/Directions70B.jsp\
    Review the directions and FAQs with the organisation's
    security/legal lead, including incident reporting and log-retention
    requirements.

8.  **MoHFW Electronic Health Record (EHR) Standards for India, 2016**\
    https://www.mohfw.gov.in/sites/default/files/EMR-EHR_Standards_for_India_as_notified_by_MOHFW_2016_0.pdf\
    Reference for health-information capture, storage, exchange,
    interoperability, privacy, and security where relevant.

9.  **CDSCO --- Medical Device Software guidance and current notices**\
    https://www.cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/Medical-Device-Diagnostics/\
    Reassess if the product's intended purpose expands into diagnosis,
    treatment recommendations, clinical urgency decisions, or other
    regulated functionality.

### Health-system cybersecurity and privacy risk management

10. **WHO: Cybersecurity and privacy maturity assessment and
    strengthening for digital health information systems (2025)**\
    https://www.who.int/europe/publications/i/item/WHO-EURO-2025-11827-51599-78854\
    Use as a structured risk-assessment aid covering governance, data
    lifecycle, transmission, disposal, monitoring, and user behaviour.
    It is not Indian legislation.

### Standards context

11. **NIST Cybersecurity Framework 2.0**\
    https://www.nist.gov/cyberframework\
    Useful for organising governance, identification, protection,
    detection, response, and recovery.

12. **NIST Secure Software Development Framework (SSDF)**\
    https://csrc.nist.gov/Projects/ssdf\
    Useful for integrating security into design, implementation, build,
    release, and vulnerability response.

13. **ISO 27799 (Health informatics --- Information security management
    in health)**\
    https://www.iso.org/\
    Check the current edition through the ISO catalogue. Use as a
    health-specific security-management reference if the organisation
    adopts it; do not claim certification without a formal certification
    process.

------------------------------------------------------------------------

## 20. Developer deliverables required from this security pass

The backend developer should return these artefacts:

1.  **Security review matrix** mapping each requirement in this document
    to Pass/Fail/Not implemented/Not applicable, evidence, owner, and
    issue link.
2.  **Route inventory** with method, purpose, authentication, role
    permissions, object-level scope, rate limit, data classification,
    and audit requirements.
3.  **Role/action matrix** enforced by backend code and covered by
    tests.
4.  **Threat model** listing assets, trust boundaries, attackers,
    threats, mitigations, and residual risks.
5.  **Data-flow and vendor map** showing where patient data travels,
    including OCR/model providers, storage, logs, backups, and
    analytics.
6.  **Secrets inventory** listing secret types and their
    storage/rotation owner---never include secret values.
7.  **Automated security test suite** covering the required cases in
    Section 17.
8.  **Dependency and configuration scan results** with resolved/accepted
    findings.
9.  **Incident-response and backup/restore runbooks** before
    real-patient use.
10. **Open-decision register** for unresolved product and legal
    questions.
11. **Penetration-test plan and remediation tracker** before a
    real-patient pilot.
12. **Written statement of residual risks** signed off by the
    organisation's accountable owner---not just the developer.

------------------------------------------------------------------------

## 21. Release gates

### Gate A --- Synthetic-data prototype

May proceed only with synthetic data, isolated development credentials,
basic authentication, server-side authorization, safe uploads, no real
messaging, and no unapproved external AI data sharing. It must not be
represented as production-ready.

### Gate B --- Internal test with realistic workflows

Require automated role/object authorization tests, correction and
approval transaction tests, audit coverage, secure configuration,
dependency/secret scans, and a tested backup/restore process if
persistent test data matters.

### Gate C --- Real-patient pilot

Do not proceed until all are complete:

-   Hospital authorises the environment and real-data use.
-   Legal/privacy review confirms applicable DPDP/IT/SPDI/CERT-In and
    other obligations, effective dates, notices, lawful basis,
    contracts, and incident process.
-   MFA is enabled for privileged accounts; account lifecycle and least
    privilege are verified.
-   Critical/high security findings are fixed and retested.
-   Independent penetration test is completed and findings are
    remediated or formally risk-accepted by the accountable
    organisation.
-   Backups, restoration, monitoring, incident response, and downtime
    reconciliation are tested.
-   Contact/consent/caregiver rules and retention policy are approved.
-   Clinical governance approves human review, uncertainty handling,
    escalation, and change approval flows.
-   Any AI provider/data flow is separately approved, or disabled.
-   There is a named operational owner and documented rollback/stop
    procedure.

### Gate D --- Production

Require an ongoing patching schedule, access recertification, periodic
security testing, monitoring and alert response, tested disaster
recovery, documented vendor reviews, and regular privacy/clinical-safety
governance. Security is a continuing process, not a one-time checklist.

------------------------------------------------------------------------

## 22. Open decisions that must not be guessed

The following are unresolved or need confirmation with the hospital:

-   Whether doctors and assistants may belong to multiple departments.
-   Routing if the original assistant is unavailable/deactivated.
-   Approval routing for patient-profile corrections without a clear
    department association.
-   Exact reminder formula, severity ratios, daytime window, and
    timezone.
-   Retry timing within the current maximum of three sends per scheduled
    reminder.
-   Who may cancel/reopen a follow-up and all permitted lifecycle
    transitions.
-   Coordinator workload weighting, tie-breakers, and temporary
    unavailability behavior.
-   Contact authorisation, consent, shared numbers, caregivers, and
    approved message/call scripts.
-   Temporary credential delivery/expiry and final session policy.
-   Final paper form layout and critical-field map.
-   Retention, archival, deletion, legal hold, and backup expiry.
-   Hosting region, vendor/subprocessor list, deployment ownership,
    backup and disaster-recovery arrangements.
-   Exact DPDP/IT/SPDI/CERT-In applicability and current effective dates
    for the operator and deployment.
-   Whether future AI use is permitted for any real data and under what
    contract, de-identification, and approval controls.

Until a decision is approved, the backend must fail safely: deny risky
actions, keep the current approved record unchanged, and surface a human
task rather than inventing a rule.

------------------------------------------------------------------------

## Final instruction to the developer

**Do not equate "the API works" with "the system is secure."** Every
security-sensitive rule must be enforced server-side, represented in the
data model, covered by automated tests, observable in audit/monitoring,
and reviewed before real patient data is used.

The goal is not to promise that the product can never be breached. The
goal is to reduce risk systematically, detect failures quickly, preserve
evidence and record integrity, recover safely, and prevent an AI or
software failure from silently becoming an unaccountable clinical
decision.
