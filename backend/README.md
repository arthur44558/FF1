# Hospital Follow-up Management Backend

Backend-only FastAPI service for a single-clinic follow-up pilot. It implements scan intake and review, clinician-authorized decisions, assistant verification, patient and encounter matching, follow-up lifecycle actions, versioned reminder policies, a durable PostgreSQL job queue, staff call tasks, contact permissions, audit records and operational summaries.

No frontend or EHR integration is included. This release has no live SMS, WhatsApp or voice provider. A fake messaging adapter is available for local development, and the outbound switch defaults to off.

## Local development

Requirements: Docker Compose and Python 3.12 if running the bootstrap script on the host.

1. Copy .env.example to .env in this directory.
2. Generate development secrets. In PowerShell, run `python -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"` for CONTACT_ENCRYPTION_KEY, then run `python -c "import secrets; print(secrets.token_urlsafe(32))"` separately for DEV_AUTH_SECRET, CONTACT_FINGERPRINT_KEY, PROVIDER_WEBHOOK_SECRET, and POSTGRES_PASSWORD. Put each result in its matching .env entry. Do not reuse values or keep the example placeholders.
3. Run docker compose up --build -d.
4. Run docker compose exec api python -m scripts.bootstrap.
5. Open http://localhost:8000/test-console/ for the development test UI or http://localhost:8000/docs for the API reference. The development API can issue short-lived local tokens at POST /api/v1/dev/token for the seeded usernames: doctor, assistant, coordinator, supervisor, admin, and auditor.

Development tokens have a 15-minute lifetime. They are available only when ENVIRONMENT=development, AUTH_MODE=development, and a secret is configured. Production uses OIDC bearer-token validation; roles and facility scope come from provisioned database users.

## Clinic form configuration

config/form_templates.json starts empty by design. Add an approved fixed-layout map using config/form_templates.example.json as a shape example, then calibrate it against the actual clinic form. Coordinates are normalized to the configured reference image dimensions. OMR records checkbox ratios and confidence for human review; it never activates an order.

The OCR step uses local Tesseract for constrained date and identifier regions. It does not call an external OCR service. If the Tesseract executable is missing or the form version is not configured, the scan enters processing_failed. No clinic form was supplied with the development plan, so the example coordinates are illustrative and must not be used to process real forms.

## API workflow

1. Provision patient and encounter identifiers from the clinic's approved source.
2. An assistant_verifier uploads a scan and enqueues processing.
3. An authenticated doctor records the clinical decision against the scan.
4. The assistant verifies identity and confirms the extracted fields. Clinical fields must match the latest doctor decision.
5. A clinic supervisor approves and activates a policy with a documented approval reference.
6. A verified required follow-up snapshots that policy and creates persistent reminder jobs. No-follow-up decisions create no jobs.
7. The worker rechecks follow-up state, permission, contact verification, sharing and policy gates before acting. Calls become staff tasks. Message jobs remain suppressed while outbound is disabled.

The policy seeded by the bootstrap script is a draft. The approved policy and contact evidence are clinic operational decisions, not software-generated approvals.

## Runtime

- API: uvicorn app.main:app --host 0.0.0.0 --port 8000
- Worker: python -m app.workers.runner
- Migrations: alembic upgrade head
- Liveness: GET /health/live
- Readiness: GET /health/ready
- Private scan data is mounted at /app/private_scans in the Compose deployment.

The app writes no message body or unmasked phone number to application logs. Contact destinations are encrypted with CONTACT_ENCRYPTION_KEY; duplicate detection uses a separate keyed CONTACT_FINGERPRINT_KEY. Back up both keys securely alongside the protected database and file storage.

## Production boundary

The production environment requires OIDC configuration and does not expose interactive API documentation. This code is an MVP foundation, not a clinic go-live approval. Review ASSUMPTIONS.md and close every clinic, provider, legal, security and operational decision before using real patient data.
