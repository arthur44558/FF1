# Patient Lookup Enumeration: Security Fix and Verification Plan

**Project:** Hospital Follow-up Coordination System\
**Scope:** Patient search/autocomplete, patient selection, and
authorization checks\
**Priority:** High --- implement before using real patient data\
**Status:** Implementation requirements; verify against the actual
codebase before marking complete

------------------------------------------------------------------------

## 1. Problem statement

The patient lookup workflow may allow an authenticated assistant account
to search common names and receive a broad list of patients with names,
dates of birth, and system-generated patient identifiers. If an account
is compromised---or a legitimate user exceeds their assigned
duties---this can expose patient information and enable patient
enumeration.

The underlying issue is **excessive data disclosure plus missing or
insufficient object-level authorization**, not merely the fact that a
database primary key exists or is visible.

A separate patient code, UUID, hidden UI field, minimum search length,
or pagination is **not** an authorization control. Every endpoint that
returns or changes patient-linked data must independently verify that
the authenticated user is allowed to perform that operation on that
patient.

This document defines the checks, implementation changes, tests, and
release gates required to address the issue. It does not claim that a
vulnerability has been confirmed in source code; confirm each item
through code review and testing.

## 2. Security objectives

-   Users can discover only patients within their explicitly authorized
    operational scope.
-   Search results disclose only the minimum fields needed to select the
    correct patient.
-   Patient identifiers never act as bearer secrets or grant access by
    themselves.
-   The backend enforces authorization on search, detail,
    selection-dependent actions, and every patient-linked API.
-   Changing an identifier in a request cannot bypass authorization.
-   Search is resistant to bulk enumeration and unusual query patterns.
-   Access attempts and security-relevant search activity can be audited
    without copying unnecessary patient data into logs.
-   UI restrictions improve usability but are never treated as the
    security boundary.

## 3. Required access model

Before implementation, define the authoritative scope rule for each
role. Do not infer access from a client-supplied department, doctor ID,
patient ID, or role value.

  -----------------------------------------------------------------------
  Role                                Patient discovery and access rule
  ----------------------------------- -----------------------------------
  Doctor's Assistant                  No broad patient-directory access.
                                      Access only the minimum patient
                                      fields needed for the specific
                                      form-entry or request-review task
                                      the assistant is authorized to
                                      perform. Scope access to assigned
                                      work and enforce it server-side.

  Reception                           Access only the minimum
                                      registration and demographic fields
                                      needed for assigned registration
                                      duties. Do not automatically grant
                                      access to clinical follow-up
                                      details.

  Doctor                              Access patient records only where
                                      the doctor is authorized as the
                                      patient's treating/assigned doctor
                                      under the hospital's policy.

  Follow-up Coordinator               Access only the
                                      patient/contact/task information
                                      required for assigned follow-up
                                      tasks and the permitted history of
                                      tasks they personally handled.

  Follow-up Head                      Access operational workload and
                                      queue information. Reveal
                                      identifiable clinical data only
                                      where explicitly necessary and
                                      authorized by policy.

  IT Admin                            Account/system administration and
                                      approved operational statistics. No
                                      routine unrestricted patient search
                                      or clinical-record access.

  Deactivated user                    No new access. Preserve historical
                                      actor IDs and audit records.
  -----------------------------------------------------------------------

**Policy requirement:** The Doctor's Assistant must not have a general
ability to browse the hospital's patient population. Access is task-based:
the assistant sees only the minimum patient data needed to complete an
assigned form or process a request. The backend must determine the task
and scope from trusted server-side records. Do not silently choose "all
patients in the hospital" as the default. If no authorized task/scope
exists, return no patient results and deny direct access.

## 3.1 Assistant request-review authority and routing

The assistant is a **workflow gatekeeper**, not the final decision-maker
for every request. For each request type, define a server-side permission
that says whether the assistant may approve/reject it or may only validate
and forward it. The UI must not let the assistant make a decision that
the backend policy does not permit.

1. **Verify the request:** Confirm that it is linked to the correct
   patient/task, came from an authorized requester, contains the required
   information/evidence, and is internally consistent. This is an
   administrative validity check, not a clinical judgement.
2. **Approve/reject only within delegated authority:** The assistant may
   approve or reject a request only when that request category is
   explicitly delegated to the assistant. Record the reason and outcome.
3. **Forward when outside authority or uncertain:** If the assistant
   cannot decide within their assigned authority, they must forward the
   request to the patient's authorized doctor. They must not reject it
   merely because it needs a doctor's decision, nor treat forwarding as
   approval.
4. **Doctor retains final authority for doctor-owned decisions:** For
   example, if a Follow-up Coordinator requests an appointment reschedule
   on the patient's behalf, the assistant can check that the request is
   complete and plausibly valid, then forward it. The patient's authorized
   doctor makes the final decision. The assistant cannot approve the
   reschedule unless a future, explicit policy delegates that exact
   decision to the assistant.
5. **No authority escalation by request data:** A requester cannot make
   a request approvable by supplying a doctor ID, changing a request type,
   or asserting that approval was granted. The backend derives the
   patient's authorized doctor and allowed transitions from trusted data.
6. **Keep an auditable state transition:** Store requester, patient/task
   reference, request category, evidence references, validation result,
   assistant actor ID, decision/forwarding reason, destination, timestamps,
   and final doctor's decision where applicable. Use states such as
   `pending_review`, `rejected_by_assistant`, `approved_by_assistant`,
   `forwarded_to_doctor`, `approved_by_doctor`, and `rejected_by_doctor`
   only where the relevant role is permitted to make that transition.
7. **Minimize data during review:** Show only the fields required to
   validate the request and route it correctly. Do not expose the full
   patient record, unrelated appointments, clinical notes, full contact
   details, or scanned forms merely because the assistant is reviewing a
   request.

Create an explicit request-type/authority matrix before implementation.
If a request type has no defined assistant authority, the safe default is
**validate completeness and forward to the authorized doctor**, not
approve or reject on the merits.

## 4. Identifier and database rules

A reasonable relational model is:

-   `patients.patient_pk`: internal primary key, preferably an opaque
    UUID or equivalent.
-   `patients.patient_code`: unique staff-facing identifier, if the
    workflow needs one.
-   `followups.patient_pk`: foreign key to `patients.patient_pk`.
-   `contacts.patient_pk`: foreign key to `patients.patient_pk`.
-   Other patient-linked tables reference the patient through a foreign
    key and apply their own authorization checks.

Rules:

1.  Do not expose internal database keys unless there is a specific,
    reviewed reason.
2.  A staff-facing patient code must not encode the patient's name, date
    of birth, department, or other sensitive attributes.
3.  Do not assume UUIDs or unpredictable codes prevent Broken Object
    Level Authorization (BOLA/IDOR).
4.  Do not use an identifier's secrecy as the authorization mechanism.
5.  Enforce foreign keys and uniqueness in the database; validate all
    incoming identifiers server-side.
6.  Avoid creating a second identifier table solely to "hide" the
    primary key. Separation may be useful for data modelling, but it
    does not replace authorization.
7.  Never accept a doctor, department, tenant, or role from the request
    as proof of the caller's authority. Derive the authenticated user
    and authorized scope from server-side identity and policy data.

## 5. Patient search API requirements

Apply these requirements to every search/autocomplete endpoint.

### 5.1 Authentication and authorization

-   Require an authenticated, active user.
-   Resolve the user's role and current scope from trusted server-side
    records.
-   Apply role-specific field permissions and patient-level object
    authorization **before returning results**.
-   Build the query so it searches only the authorized patient set; do
    not fetch all matches and rely on the frontend to filter them.
-   Reject or ignore client-supplied scope parameters unless the server
    verifies that the caller is allowed to use them.
-   Return a consistent, minimal response for unauthorized or
    out-of-scope records. Do not reveal whether an inaccessible patient
    exists.
-   Re-check authorization when the selected patient is opened and again
    for every subsequent read or mutation. Also verify that the caller is
    authorized for the specific task/request and requested action; patient
    access alone does not imply authority to approve, reject, or forward.

### 5.2 Search input and result minimization

-   Require a sensible minimum prefix length for name search (for
    example, 3 characters), while allowing exact patient-code lookup if
    the workflow requires it.
-   Normalize input safely and use parameterized queries or ORM
    parameter binding. Never concatenate raw search input into SQL.
-   Limit page size on the server (for example, at most 10 results per
    page); do not trust a client-supplied larger limit.
-   Use cursor or stable pagination where practical. Pagination reduces
    response size but is not a security boundary.
-   Return only the fields needed for the specific authorized task. For
    patient selection, a proposed minimum is a display name plus one
    approved disambiguator. Include date of birth or a staff-facing
    patient code only if the workflow demonstrably requires it. For form
    entry, return only the fields required to fill that form; for request
    review, return only the fields required to validate and route that
    request.
-   Do not return address, phone/email, diagnosis, clinical notes,
    appointment history, scanned forms, or other contact/clinical
    details in search results. If a specific task requires a field such as
    a verified contact method, retrieve it through a separately
    authorized, task-scoped endpoint rather than expanding every search
    result.
-   Prefer masking or withholding DOB and using a less sensitive
    disambiguator when operationally feasible. Document why each
    returned field is necessary.
-   Do not provide an unbounded "list all patients" search endpoint to
    ordinary assistant accounts.
-   Avoid search responses containing total counts or metadata that
    unnecessarily reveal the size of the patient population.
-   Do not distinguish "patient does not exist" from "patient exists but
    is outside your scope" in user-facing responses.

### 5.3 Abuse controls

-   Apply per-user and, where appropriate, per-session/IP rate limits to
    search endpoints.
-   Add configurable thresholds for unusually broad or rapid searches;
    tune them to normal clinical workflow to avoid blocking legitimate
    use.
-   Audit searches with actor ID, timestamp, result count,
    action/context, and a privacy-conscious query representation. Do not
    log full patient lists, DOBs, contact details, clinical content,
    access tokens, or session secrets.
-   Alert or flag patterns such as many distinct name searches in a
    short period, repeated one-character/common-name probing, sequential
    patient-code attempts, and high-volume pagination.
-   Provide a way to revoke sessions and disable compromised accounts
    quickly.
-   Apply MFA and short-lived/revocable sessions according to the
    project's authentication policy.

## 6. Patient selection and downstream endpoint checks

A secure search endpoint is insufficient if another endpoint can be
called directly.

For **every** patient-linked endpoint---detail, follow-up retrieval,
contact retrieval, form upload, correction proposal, schedule change,
note creation, task assignment, export, and download:

1.  Authenticate the caller and confirm the account is active.
2.  Load the target object server-side.
3.  Resolve its patient relationship from the database, not from a
    client assertion.
4.  Check the caller's role, task assignment, patient relationship, and
    permitted action.
5.  Check field-level permissions for returned or changed data.
6.  Reject unauthorized access before returning protected data or making
    changes.
7.  Record relevant allow/deny events in the security audit trail.
8.  Apply the same policy to nested routes, bulk endpoints, exports,
    background jobs, and file-download URLs.

Do not rely on the fact that a patient appeared in a dropdown. The
dropdown selection is untrusted input. A user can edit requests, call
APIs directly, replay requests, or substitute another patient's ID.

### File and upload checks

-   Check authorization for the patient and record before accepting an
    upload.
-   Validate file type, size, content, and storage location
    independently of the filename or browser MIME type.
-   Keep uploaded files private; do not expose permanent public URLs.
-   Authorize every download at access time, including signed-link
    issuance.
-   Prevent an authorized user from substituting another patient's ID in
    a file upload or download request.
-   Preserve required originals and version/audit history under the
    project's records policy.

## 7. Suggested implementation pattern

Use a centralized authorization service/policy rather than duplicating
ad hoc checks across routes.

Example pseudocode (adapt names to the actual stack):

``` python
def search_patients(current_user, query, cursor=None, limit=10):
    require_authenticated_active_user(current_user)
    require_role_permission(current_user, "patient:search")

    safe_limit = min(max(int(limit), 1), 10)
    normalized_query = normalize_search_query(query)
    require_allowed_search_shape(normalized_query)

    # The scope predicate must be generated from trusted server-side policy.
    authorized_scope = patient_scope_for(current_user)

    return repository.search_patients(
        query=normalized_query,
        authorized_scope=authorized_scope,
        cursor=cursor,
        limit=safe_limit,
        fields=["display_name", "approved_disambiguator", "patient_code"],
    )


def get_patient(current_user, patient_id):
    require_authenticated_active_user(current_user)
    patient = repository.get_patient_or_404(patient_id)
    require_object_permission(
        user=current_user,
        action="patient:read",
        patient=patient,
    )
    return serialize_patient_for_role(current_user, patient)
```

Implementation notes:

-   `patient_scope_for`, `require_object_permission`, and
    `serialize_patient_for_role` are illustrative interfaces, not
    existing project functions.
-   The database query must apply the authorized scope in the query
    itself where practical.
-   A generic `404` for inaccessible objects can reduce existence
    disclosure; use consistent semantics across equivalent endpoints.
-   Do not catch authorization failures and continue with an
    unrestricted query.
-   Avoid "check once, trust forever" behavior. Re-check permissions at
    each API boundary, especially for mutations and downloads.
-   Use database transactions and appropriate locking/concurrency
    controls for sensitive mutations.

## 8. Automated security tests

Create automated tests for both expected access and denial. Use
synthetic fixtures and at least two users with different scopes.

### 8.1 Search enumeration tests

-   [ ] A user cannot search outside their authorized scope.
-   [ ] A common name matching many patients returns only authorized
    patients.
-   [ ] The response never includes unauthorized patients, even if they
    match more strongly.
-   [ ] The response includes only allowlisted fields.
-   [ ] DOB is omitted or masked unless the approved workflow requires
    it.
-   [ ] Page size is capped server-side even when the client requests a
    very large limit.
-   [ ] Minimum search length is enforced where configured.
-   [ ] Empty, whitespace-only, malformed, oversized, Unicode, and
    SQL-like input are handled safely.
-   [ ] Search results do not expose total hospital patient counts or
    inaccessible-patient existence.
-   [ ] Rate limiting activates at configured thresholds and resets as
    intended.
-   [ ] A deactivated user cannot search.
-   [ ] Role changes or scope revocation take effect without relying on
    stale client state.

### 8.2 BOLA/IDOR tests

For each patient-linked endpoint:

-   [ ] User A cannot read User B's out-of-scope patient by substituting
    a valid patient ID.
-   [ ] User A cannot read a follow-up belonging to an out-of-scope
    patient by substituting a follow-up ID.
-   [ ] User A cannot retrieve another patient's contacts, scanned
    forms, notes, or history.
-   [ ] User A cannot upload a file against another patient's ID.
-   [ ] User A cannot download another patient's file by changing a
    record/file ID.
-   [ ] User A cannot create or modify a correction request, schedule,
    task, or note for an unauthorized patient.
-   [ ] Bulk operations reject or filter unauthorized objects according
    to a documented, consistent policy; they must never partially leak
    protected details.
-   [ ] Background jobs verify their trusted job context and do not
    trust arbitrary user-supplied identifiers.
-   [ ] Changing a patient ID, follow-up ID, doctor ID, or department ID
    in the request never grants access.

### 8.3 Regression and privacy tests

-   [ ] A permitted assistant can still find the intended patient using
    the approved workflow.
-   [ ] Ambiguous matches require the user to select/verify the correct
    patient; no silent auto-selection.
-   [ ] Logs contain actor ID and event metadata but no full patient
    result payloads, raw clinical content, passwords, tokens, or session
    secrets.
-   [ ] Audit events are generated for sensitive allowed and denied
    access attempts as defined by policy.
-   [ ] API error messages do not disclose stack traces, database
    details, or inaccessible patient attributes.
-   [ ] Authorization is enforced by the backend even when UI controls
    are bypassed.

Use parameterized tests across roles and endpoints. Add regression tests
for each authorization bug found. Do not treat a passing frontend test
as evidence that backend authorization is secure.

## 9. Manual verification / adversarial test plan

Use only synthetic or explicitly approved de-identified data in a
non-production environment.

1.  Create two synthetic patients in different authorized scopes.
2.  Sign in as an assistant authorized for Patient A only.
3.  Search a common name that matches both patients. Confirm Patient B
    never appears in the response body, not merely that the UI hides it.
4.  Capture a permitted request and substitute Patient B's identifier.
    Try the detail, follow-up, contact, upload, download, correction,
    and schedule endpoints.
5.  Repeat using a follow-up ID or file ID that belongs to Patient B
    rather than the patient ID.
6.  Attempt oversized page limits, repeated prefixes, sequential codes,
    empty strings, and malformed search input.
7.  Deactivate the test account or revoke its scope and repeat requests
    using an existing session/token.
8.  Inspect server logs and audit records for both successful and denied
    attempts.
9.  Verify that no hidden frontend field, API response, error message,
    or exported payload exposes unauthorized records.
10. Save evidence of each result and link the test to the corresponding
    endpoint and code change.

Do not run enumeration tests against a live hospital system or real
patient population without explicit authorization and a controlled test
plan.

## 10. Audit and monitoring requirements

Record security-relevant events with, where appropriate:

-   authenticated actor's permanent user ID;
-   timestamp in a consistent timezone;
-   action and endpoint category;
-   target record reference or internal audit-safe identifier;
-   authorization outcome and reason category;
-   result count for searches;
-   correlation/request ID;
-   relevant scope/policy version, if available.

Avoid recording full search result lists or unnecessary patient data.
Protect audit records from ordinary users' alteration, restrict access,
and define retention. Do not store passwords, session tokens, API keys,
or other secrets in logs.

Monitor for high-volume enumeration patterns, repeated denied object
access, unusual access times/volumes, bulk downloads, and activity
inconsistent with the user's assigned duties. Alerting thresholds must
be reviewed against expected workflows.

## 11. Implementation sequence

1.  **Inventory:** Identify every patient search, patient detail,
    follow-up, contact, upload/download, correction, schedule, task,
    export, and bulk endpoint.
2.  **Policy:** Document the exact patient-scope rule for every role;
    obtain hospital/product-owner sign-off.
3.  **Centralize:** Implement reusable server-side patient-scope and
    object-permission checks.
4.  **Constrain search:** Apply scope in the query, allowlist response
    fields, cap page size, and add rate limits.
5.  **Protect downstream APIs:** Add object-level and field-level checks
    to every patient-linked endpoint.
6.  **Protect files:** Authorize upload, download, and signed-link
    issuance against the linked patient and record.
7.  **Audit:** Add privacy-conscious allow/deny events and enumeration
    monitoring.
8.  **Test:** Add automated role/scope matrix tests and run the manual
    synthetic-data plan.
9.  **Review:** Have someone other than the implementer review
    authorization logic and test coverage.
10. **Release gate:** Do not use real patient data until all critical
    tests pass, scope policy is approved, and the security review has no
    unresolved critical/high findings.

## 12. Definition of done

This issue is complete only when:

-   [ ] The patient-search scope is explicit, approved, and enforced
    server-side.
-   [ ] Search responses are minimal, bounded, and contain no
    out-of-scope patient data.
-   [ ] Every patient-linked endpoint has documented object-level
    authorization.
-   [ ] ID substitution tests fail safely across patient, follow-up,
    contact, file, and mutation endpoints.
-   [ ] Rate limiting and enumeration monitoring are active and tested.
-   [ ] Audit logging is privacy-conscious and protected.
-   [ ] Automated tests run in CI and cover permitted and denied access.
-   [ ] Independent code review is complete.
-   [ ] No real patient data is introduced before release gates are
    satisfied.

## 13. References

-   OWASP API Security Top 10 --- Broken Object Level Authorization
    (BOLA):
    https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
-   OWASP Authorization Cheat Sheet:
    https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
-   OWASP API Security Top 10: https://owasp.org/API-Security/
-   NIST Digital Identity Guidelines (authentication/session guidance):
    https://pages.nist.gov/800-63-4/

These references inform the control design. They do not substitute for
reviewing the actual implementation, applicable Indian legal
requirements, or the hospital's approved access policy.
