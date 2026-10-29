// Vercel Serverless Function to handle CareTrack API requests on Vercel
const DEFAULT_STAFF = [
  { id: "usr-1", username: "doctor", display_name: "Dr. Amelia Reed", role: "doctor", system_identifier: "DOC-1029", work_email: "amelia.reed@caretrack.health", department: "Cardiology", status: "active", is_active: true },
  { id: "usr-2", username: "assistant", display_name: "Dr. Marcus Chen (Assistant)", role: "assistant_verifier", system_identifier: "AST-9021", work_email: "marcus.chen@caretrack.health", department: "Emergency Medicine", status: "active", is_active: true },
  { id: "usr-3", username: "coordinator", display_name: "James Okafor", role: "followup_coordinator", system_identifier: "STF-4410", work_email: "james.okafor@caretrack.health", department: "Laboratory", status: "active", is_active: true },
  { id: "usr-4", username: "supervisor", display_name: "Nadia Williams (Head)", role: "clinic_supervisor", system_identifier: "HD-101", work_email: "nadia.williams@caretrack.health", department: "Nursing Operations", status: "active", is_active: true },
  { id: "usr-5", username: "reception", display_name: "Priya Nair", role: "receptionist", system_identifier: "RCP-302", work_email: "priya.nair@caretrack.health", department: "Front Office", status: "active", is_active: true },
  { id: "usr-6", username: "admin", display_name: "IT Head", role: "system_admin", system_identifier: "ITH-001", work_email: "it.head@caretrack.health", department: "Security Operations", status: "active", is_active: true },
  { id: "usr-7", username: "auditor", display_name: "Compliance Auditor", role: "auditor", system_identifier: "AUD-001", work_email: "auditor@caretrack.health", department: "Compliance", status: "active", is_active: true },
];

let inMemoryRegistrations = [
  {
    id: "req-divyansh-01",
    full_name: "Divyansh",
    work_email: "div6349@gmail.com",
    department: "Cardiology",
    requested_role: "receptionist",
    status: "pending",
    certification_agreed: true,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  }
];

let approvedRegistrations = [];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";
  const body = req.body || {};

  // 1. Registration Request
  if (url.includes("/api/v1/auth/register-request") && req.method === "POST") {
    const regId = "req-" + Math.random().toString(36).substring(2, 9);
    const item = {
      id: regId,
      full_name: body.full_name || "Applicant",
      work_email: body.work_email || "",
      department: body.department || "General",
      requested_role: body.requested_role || "receptionist",
      status: "pending",
      certification_agreed: true,
      created_at: new Date().toISOString(),
    };
    inMemoryRegistrations.unshift(item);

    return res.status(201).json({
      id: regId,
      status: "pending",
      message: "Registration request submitted successfully. Awaiting administrator approval.",
    });
  }

  // 2. Auth Login
  if (url.includes("/api/v1/auth/login") && req.method === "POST") {
    const identifier = (body.email || body.unique_id || "").toLowerCase().trim();
    const pwd = (body.password || "").trim();

    const matched = DEFAULT_STAFF.find(
      (u) => u.work_email.toLowerCase() === identifier || u.system_identifier.toLowerCase() === identifier
    );
    if (matched && (pwd === "CareTrack@2026" || pwd.length >= 6)) {
      return res.status(200).json({
        access_token: "caretrack-token-" + matched.role + "-" + Date.now(),
        token_type: "bearer",
        expires_in: 900,
        role: matched.role,
        system_identifier: matched.system_identifier,
        display_name: matched.display_name,
      });
    }

    const foundApproved = approvedRegistrations.find(
      (u) => u.work_email.toLowerCase() === identifier || u.system_identifier.toLowerCase() === identifier
    );
    if (foundApproved) {
      return res.status(200).json({
        access_token: "caretrack-token-user-" + Date.now(),
        token_type: "bearer",
        expires_in: 900,
        role: foundApproved.role,
        system_identifier: foundApproved.system_identifier,
        display_name: foundApproved.display_name,
      });
    }

    return res.status(401).json({
      detail: { code: "invalid_credentials", message: "Invalid email or password" },
    });
  }

  // 3. Current User Profile
  if (url.includes("/api/v1/me")) {
    const authHeader = req.headers.authorization || "";
    let user = DEFAULT_STAFF[5]; // IT Head default

    for (const s of DEFAULT_STAFF) {
      if (authHeader.includes(s.role)) {
        user = s;
        break;
      }
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
      role: user.role,
      system_identifier: user.system_identifier,
      display_name: user.display_name,
      work_email: user.work_email,
      status: "active",
      is_active: true,
      department: user.department,
      facility_id: "fac-001",
      permissions: [
        "patient.read", "patient.write", "scan.upload", "scan.verify",
        "clinical.review", "followup.create", "followup.read", "followup.write",
        "followup.reschedule", "followup.cancel", "reminder.read", "reminder.execute",
        "policy.read", "policy.author", "policy.approve", "policy.activate",
        "audit.read", "contact.read", "contact.reveal", "user.manage", "system.admin"
      ],
    });
  }

  // 4. Staff Accounts Directory
  if (url.includes("/api/v1/users") && req.method === "GET") {
    return res.status(200).json([...DEFAULT_STAFF, ...approvedRegistrations]);
  }

  // 5. Admin Registration Requests Queue
  if (url.includes("/api/v1/admin/registration-requests")) {
    if (req.method === "POST" && url.includes("/approve")) {
      const parts = url.split("/");
      const id = parts[parts.indexOf("registration-requests") + 1];
      const target = inMemoryRegistrations.find((r) => r.id === id) || inMemoryRegistrations[0];
      const allottedId = "RCP-" + Math.floor(1000 + Math.random() * 9000);

      inMemoryRegistrations = inMemoryRegistrations.filter((r) => r.id !== id);
      const newUser = {
        id: "usr-" + (target?.id || Date.now()),
        username: target?.work_email || "approved_staff",
        display_name: target?.full_name || "Approved Staff",
        role: target?.requested_role || "receptionist",
        system_identifier: allottedId,
        work_email: target?.work_email || "",
        department: target?.department || "Cardiology",
        status: "active",
        is_active: true,
        created_at: new Date().toISOString(),
      };
      approvedRegistrations.push(newUser);

      return res.status(200).json(newUser);
    }

    if (req.method === "POST" && url.includes("/reject")) {
      const parts = url.split("/");
      const id = parts[parts.indexOf("registration-requests") + 1];
      inMemoryRegistrations = inMemoryRegistrations.filter((r) => r.id !== id);
      return res.status(200).json({ status: "rejected", message: "Request rejected successfully" });
    }

    return res.status(200).json(inMemoryRegistrations);
  }

  // 6. Audit Events
  if (url.includes("/api/v1/audit-events")) {
    return res.status(200).json({
      items: [
        {
          id: "aud-1",
          actor_user_id: "usr-6",
          actor_username: "admin",
          action: "auth.login",
          entity_type: "user",
          entity_id: "usr-6",
          recorded_at: new Date().toISOString(),
          summary: { outcome: "success", system_identifier: "ITH-001" },
        },
        {
          id: "aud-2",
          actor_user_id: "usr-1",
          actor_username: "doctor",
          action: "clinical.review",
          entity_type: "scan",
          entity_id: "scan-901",
          recorded_at: new Date(Date.now() - 3600000).toISOString(),
          summary: { outcome: "verified", followup_scheduled: true },
        }
      ],
      total: 2,
      page: 1,
      page_size: 50,
    });
  }

  // 7. Operations Summary
  if (url.includes("/api/v1/operations/summary")) {
    return res.status(200).json({
      active_followups_total: 24,
      pending_verification: 3,
      overdue_followups: 1,
      scheduled_reminders_24h: 8,
      completed_this_month: 46,
      opt_out_rate_percent: 0.9,
      scans_processed_today: 14,
    });
  }

  // 8. Health Checks
  if (url.includes("/health/")) {
    return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  }

  return res.status(200).json({ status: "success", data: [] });
}
