// Vercel Serverless Function to handle CareTrack API requests on Vercel
const DEMO_ACCOUNTS = {
  "amelia.reed@caretrack.health": { role: "doctor", name: "Dr. Amelia Reed", id: "DOC-1029" },
  "doc-1029": { role: "doctor", name: "Dr. Amelia Reed", id: "DOC-1029" },
  "marcus.chen@caretrack.health": { role: "assistant_verifier", name: "Dr. Marcus Chen (Assistant)", id: "AST-9021" },
  "ast-9021": { role: "assistant_verifier", name: "Dr. Marcus Chen (Assistant)", id: "AST-9021" },
  "james.okafor@caretrack.health": { role: "followup_coordinator", name: "James Okafor", id: "STF-4410" },
  "stf-4410": { role: "followup_coordinator", name: "James Okafor", id: "STF-4410" },
  "nadia.williams@caretrack.health": { role: "clinic_supervisor", name: "Nadia Williams (Head)", id: "HD-101" },
  "hd-101": { role: "clinic_supervisor", name: "Nadia Williams (Head)", id: "HD-101" },
  "priya.nair@caretrack.health": { role: "receptionist", name: "Priya Nair", id: "RCP-302" },
  "rcp-302": { role: "receptionist", name: "Priya Nair", id: "RCP-302" },
  "it.head@caretrack.health": { role: "system_admin", name: "IT Head", id: "ITH-001" },
  "ith-001": { role: "system_admin", name: "IT Head", id: "ITH-001" },
  "auditor@caretrack.health": { role: "auditor", name: "Compliance Auditor", id: "AUD-001" },
  "aud-001": { role: "auditor", name: "Compliance Auditor", id: "AUD-001" },
};

let inMemoryRegistrations = [];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Parse path
  const url = req.url || "";
  const body = req.body || {};

  // 1. Registration Request
  if (url.includes("/api/v1/auth/register-request") && req.method === "POST") {
    const regId = "req-" + Math.random().toString(36).substring(2, 9);
    const item = {
      id: regId,
      full_name: body.full_name || "Staff Member",
      work_email: body.work_email || "",
      department: body.department || "General",
      requested_role: body.requested_role || "doctor",
      status: "pending",
      created_at: new Date().toISOString(),
    };
    inMemoryRegistrations.push(item);

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

    const matched = DEMO_ACCOUNTS[identifier];
    if (matched && (pwd === "CareTrack@2026" || pwd.length >= 6)) {
      return res.status(200).json({
        access_token: "caretrack-token-" + matched.role + "-" + Date.now(),
        token_type: "bearer",
        expires_in: 900,
        role: matched.role,
        system_identifier: matched.id,
        display_name: matched.name,
      });
    }

    // Check if matched approved registration
    const foundReg = inMemoryRegistrations.find(
      (r) => r.work_email && r.work_email.toLowerCase() === identifier && r.status === "approved"
    );
    if (foundReg) {
      return res.status(200).json({
        access_token: "caretrack-token-user-" + Date.now(),
        token_type: "bearer",
        expires_in: 900,
        role: foundReg.requested_role,
        system_identifier: foundReg.system_identifier || "USR-1001",
        display_name: foundReg.full_name,
      });
    }

    return res.status(401).json({
      detail: { code: "invalid_credentials", message: "Invalid email or password" },
    });
  }

  // 3. Current User Profile
  if (url.includes("/api/v1/me")) {
    const authHeader = req.headers.authorization || "";
    let role = "doctor";
    let name = "Dr. Amelia Reed";
    let sysId = "DOC-1029";
    let email = "amelia.reed@caretrack.health";

    for (const acc of Object.values(DEMO_ACCOUNTS)) {
      if (authHeader.includes(acc.role)) {
        role = acc.role;
        name = acc.name;
        sysId = acc.id;
        email = `${acc.id.toLowerCase()}@caretrack.health`;
        break;
      }
    }

    return res.status(200).json({
      id: "usr-" + sysId,
      username: sysId,
      role: role,
      system_identifier: sysId,
      display_name: name,
      work_email: email,
      status: "active",
      is_active: true,
      department: "Clinical Care",
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

  // 4. Admin Registration Requests
  if (url.includes("/api/v1/admin/registration-requests")) {
    if (req.method === "POST" && url.includes("/approve")) {
      const parts = url.split("/");
      const id = parts[parts.indexOf("registration-requests") + 1];
      const item = inMemoryRegistrations.find((r) => r.id === id);
      if (item) {
        item.status = "approved";
        item.system_identifier = "RCP-7821";
      }
      return res.status(200).json({
        id: "usr-" + id,
        username: item?.work_email || "approved_staff",
        role: item?.requested_role || "receptionist",
        system_identifier: item?.system_identifier || "RCP-7821",
        display_name: item?.full_name || "Approved Staff",
        work_email: item?.work_email || "",
        department: item?.department || "General",
        status: "active",
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }
    return res.status(200).json(inMemoryRegistrations);
  }

  // 5. Operations Summary
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

  // 6. Health Checks
  if (url.includes("/health/")) {
    return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  }

  // Fallback 200 for other API endpoints
  return res.status(200).json({ status: "success", data: [] });
}
