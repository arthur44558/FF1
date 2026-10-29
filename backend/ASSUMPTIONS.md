# Assumptions and clinic decisions

This implementation follows the attached backend plan. It does not treat proposed defaults as clinical approval.

## Implemented defaults

- Clinic timezone defaults to Asia/Kolkata; each facility stores its IANA timezone.
- Patient identity uses a facility-scoped hospital identifier and an encounter identifier. Names and phone numbers are not matching keys.
- Every scan needs a clinician-authored decision and an assistant verification. A clinical mismatch goes back for clinician clarification.
- A verified no-follow-up decision is retained as not_required and creates no reminder jobs.
- A required follow-up needs a clinician-selected severity and scheduled date/time.
- Reminder policy checkpoints use the plan fractions 0.29, 0.57, 0.79, 0.86 and 0.93.
- Staff call tasks never place an automatic voice call.
- Unknown or expired permission blocks automated outreach. Shared contacts cannot be called.
- Contact endpoints are encrypted at rest by the application and masked in API responses.
- Only a fake messaging provider is implemented. Outbound communications are disabled by default.
- Scanned files are private JPEG, PNG or WebP objects in a private filesystem volume.
- Audit records are append-only through the application API; application routes expose no update or delete operation for them.

## Required before real patient data or production use

- Approve the paper form layout/version, field coordinates, date format and any default appointment time.
- Validate OMR sensitivity, specificity, date accuracy and manual-review rate with a representative clinic-approved dataset.
- Confirm the hospital's patient and encounter identifiers and identity mismatch workflow.
- Approve severity definitions, reminder cadence, call scripts, quiet hours, holidays and overdue escalation.
- Define how contact sharing and verification are established, permitted channels, opt-in evidence and opt-out handling.
- Review the selected message provider, templates, applicable Indian telecom/provider rules and clinic privacy policy.
- Set retention/deletion, access review, backup, restore, incident response and break-glass procedures.
- Configure managed OIDC, TLS, private storage encryption, key rotation, rate limits and operational monitoring.
- Complete a security review and clinic go/no-go approval.

The initial policy created by scripts/bootstrap.py is a draft. It is not active until a clinic supervisor records an approval reference and activates it. The default form template file is empty, so scan processing fails closed until the clinic's fixed-layout template is configured.
