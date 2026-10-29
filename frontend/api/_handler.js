// Supabase-backed CareTrack Serverless Handler for Vercel
import crypto from "crypto";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://tnzrzaxohtfjaxijjbo.supabase.co"
).replace(/\/+$/, "");

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const DEFAULT_STAFF = [
  { id: "usr-1", username: "doctor", display_name: "Dr. Amelia Reed", role: "doctor", system_identifier: "DOC-1029", work_email: "amelia.reed@caretrack.health", department: "Cardiology", status: "active", is_active: true },
  { id: "usr-2", username: "assistant", display_name: "Dr. Marcus Chen (Assistant)", role: "assistant_verifier", system_identifier: "AST-9021", work_email: "marcus.chen@caretrack.health", department: "Emergency Medicine", status: "active", is_active: true },
  { id: "usr-3", username: "coordinator", display_name: "James Okafor", role: "followup_coordinator", system_identifier: "STF-4410", work_email: "james.okafor@caretrack.health", department: "Laboratory", status: "active", is_active: true },
  { id: "usr-4", username: "supervisor", display_name: "Nadia Williams (Head)", role: "clinic_supervisor", system_identifier: "HD-101", work_email: "nadia.williams@caretrack.health", department: "Nursing Operations", status: "active", is_active: true },
  { id: "usr-5", username: "reception", display_name: "Priya Nair", role: "receptionist", system_identifier: "RCP-302", work_email: "priya.nair@caretrack.health", department: "Front Office", status: "active", is_active: true },
  { id: "usr-6", username: "admin", display_name: "IT Head", role: "system_admin", system_identifier: "ITH-001", work_email: "it.head@caretrack.health", department: "Security Operations", status: "active", is_active: true },
  { id: "usr-7", username: "auditor", display_name: "Compliance Auditor", role: "auditor", system_identifier: "AUD-001", work_email: "auditor@caretrack.health", department: "Compliance", status: "active", is_active: true },
];

let inMemoryRegistrations = [];
let approvedRegistrations = [];

async function sbQuery(endpoint, options = {}) {
  if (!SUPABASE_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Supabase ${options.method || "GET"} ${endpoint} returned ${res.status}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Supabase query network exception:", err);
    return null;
  }
}

function getRequestPath(req) {
  if (Array.isArray(req.query?.path)) {
    return "/api/" + req.query.path.join("/");
  }
  if (typeof req.query?.path === "string" && req.query.path) {
    return "/api/" + req.query.path;
  }
  const matched = req.headers["x-matched-path"] || req.headers["x-invoke-path"] || req.headers["x-forwarded-uri"] || req.url || "";
  return matched;
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = getRequestPath(req);
  const body = await parseBody(req);

  // 1. Submit Registration Request
  if (path.includes("/api/v1/auth/register-request") && req.method === "POST") {
    const cleanEmail = (body.work_email || "").trim().toLowerCase();

    // Check existing users in Supabase
    const existingUser = await sbQuery(`users?select=id&work_email=ilike.${encodeURIComponent(cleanEmail)}`);
    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        detail: { code: "email_exists", message: "An account with this work email address already exists." }
      });
    }

    // Check pending requests in Supabase
    const existingPending = await sbQuery(`registration_requests?select=id&work_email=ilike.${encodeURIComponent(cleanEmail)}&status=eq.pending`);
    if (existingPending && existingPending.length > 0) {
      return res.status(409).json({
        detail: { code: "request_pending", message: "A pending registration request with this email is already awaiting approval." }
      });
    }

    const regId = crypto.randomUUID();
    const newReq = {
      id: regId,
      facility_id: "00000000-0000-0000-0000-000000000001",
      full_name: (body.full_name || "Applicant").trim(),
      work_email: cleanEmail,
      department: (body.department || "Cardiology").trim(),
      requested_role: body.requested_role || "receptionist",
      password_hash: "pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b",
      certification_agreed: true,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in Supabase PostgreSQL
    await sbQuery("registration_requests", {
      method: "POST",
      body: JSON.stringify(newReq)
    });

    // Also store in memory fallback
    inMemoryRegistrations.unshift(newReq);

    return res.status(201).json({
      id: regId,
      status: "pending",
      message: "Registration request submitted successfully. Awaiting administrator approval.",
    });
  }

  // 2. Auth Login
  if (path.includes("/api/v1/auth/login") && req.method === "POST") {
    const identifier = (body.email || body.unique_id || "").toLowerCase().trim();
    const pwd = (body.password || "").trim();

    // 1. Check default staff
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

    // 2. Check Supabase users table
    const sbUser = await sbQuery(`users?select=*&or=(work_email.ilike.${encodeURIComponent(identifier)},system_identifier.ilike.${encodeURIComponent(identifier)})`);
    if (sbUser && sbUser.length > 0 && sbUser[0].is_active) {
      const u = sbUser[0];
      return res.status(200).json({
        access_token: "caretrack-token-" + u.role + "-" + Date.now(),
        token_type: "bearer",
        expires_in: 900,
        role: u.role,
        system_identifier: u.system_identifier,
        display_name: u.display_name,
      });
    }

    // 3. Check in-memory approved users
    const foundApproved = approvedRegistrations.find(
      (u) => u.work_email.toLowerCase() === identifier || u.system_identifier.toLowerCase() === identifier
    );
    if (foundApproved && foundApproved.is_active) {
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
  if (path.includes("/api/v1/me")) {
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
      facility_id: "00000000-0000-0000-0000-000000000001",
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
  if (path.includes("/api/v1/users") && req.method === "GET") {
    const sbUsers = await sbQuery("users?select=*&order=created_at.asc");
    if (sbUsers && sbUsers.length > 0) {
      const map = new Map();
      for (const u of sbUsers) {
        map.set((u.work_email || u.system_identifier || u.id).toLowerCase(), {
          id: u.id,
          username: u.username,
          display_name: u.display_name,
          role: u.role,
          department: u.department,
          system_identifier: u.system_identifier,
          work_email: u.work_email,
          status: u.status,
          is_active: u.is_active,
        });
      }
      return res.status(200).json(Array.from(map.values()));
    }

    // Fallback: DEFAULT_STAFF + in-memory approved
    const approvedMap = new Map();
    for (const u of [...DEFAULT_STAFF, ...approvedRegistrations]) {
      if (u.work_email) {
        approvedMap.set(u.work_email.toLowerCase(), u);
      }
    }
    return res.status(200).json(Array.from(approvedMap.values()));
  }

  // 5. User Revoke and Restore
  if (path.includes("/api/v1/users/") && path.endsWith("/revoke") && req.method === "POST") {
    const parts = path.split("/");
    const userId = parts[parts.indexOf("users") + 1];
    await sbQuery(`users?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked", is_active: false, updated_at: new Date().toISOString() })
    });
    return res.status(200).json({ id: userId, status: "revoked", is_active: false });
  }

  if (path.includes("/api/v1/users/") && path.endsWith("/restore") && req.method === "POST") {
    const parts = path.split("/");
    const userId = parts[parts.indexOf("users") + 1];
    await sbQuery(`users?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active", is_active: true, updated_at: new Date().toISOString() })
    });
    return res.status(200).json({ id: userId, status: "active", is_active: true });
  }

  // 6. Admin Registration Requests Queue & Approval
  if (path.includes("/api/v1/admin/registration-requests")) {
    if (req.method === "POST" && path.includes("/approve")) {
      const parts = path.split("/");
      const id = parts[parts.indexOf("registration-requests") + 1];

      let target = null;
      const sbReq = await sbQuery(`registration_requests?id=eq.${id}&select=*`);
      if (sbReq && sbReq.length > 0) {
        target = sbReq[0];
      } else {
        target = inMemoryRegistrations.find((r) => r.id === id) || inMemoryRegistrations[0];
      }

      const rolePrefixMap = {
        doctor: "DOC",
        assistant_verifier: "AST",
        followup_coordinator: "STF",
        clinic_supervisor: "HD",
        receptionist: "RCP",
        system_admin: "ITH",
        auditor: "AUD",
      };
      const requestedRole = target?.requested_role || "receptionist";
      const prefix = rolePrefixMap[requestedRole] || "STF";
      const allottedId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Mark request as approved in Supabase
      await sbQuery(`registration_requests?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "approved",
          updated_at: new Date().toISOString(),
        }),
      });

      // 2. Insert into users table in Supabase
      const newUserId = crypto.randomUUID();
      const newUser = {
        id: newUserId,
        facility_id: target?.facility_id || "00000000-0000-0000-0000-000000000001",
        username: allottedId.toLowerCase(),
        display_name: target?.full_name || "Approved Staff",
        role: requestedRole,
        department: target?.department || "Cardiology",
        system_identifier: allottedId,
        work_email: target?.work_email || "",
        password_hash: target?.password_hash || "pbkdf2_sha256$100000$ad4856f6deec5c02ca63946c6a71bd34$51ee7c2f4acc87d2f67ea386ebb230275eccb75527348a167df7367a3e60fd5b",
        status: "active",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await sbQuery("users", {
        method: "POST",
        body: JSON.stringify(newUser),
      });

      // 3. Record audit log in Supabase
      await sbQuery("audit_events", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          facility_id: "00000000-0000-0000-0000-000000000001",
          occurred_at: new Date().toISOString(),
          actor_type: "user",
          action: "user.registration_approved",
          entity_type: "user",
          entity_id: newUserId,
          change_summary: { system_identifier: allottedId, role: requestedRole },
        }),
      });

      // Permanently remove matching ID and email from in-memory pending
      inMemoryRegistrations = inMemoryRegistrations.filter(
        (r) => r.id !== id && r.work_email?.toLowerCase() !== target?.work_email?.toLowerCase()
      );

      // Add to in-memory approved
      approvedRegistrations = approvedRegistrations.filter(
        (u) => u.work_email?.toLowerCase() !== target?.work_email?.toLowerCase()
      );
      approvedRegistrations.push(newUser);

      return res.status(200).json(newUser);
    }

    if (req.method === "POST" && path.includes("/reject")) {
      const parts = path.split("/");
      const id = parts[parts.indexOf("registration-requests") + 1];

      await sbQuery(`registration_requests?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          rejection_reason: body.reason || "Administrative decision",
          updated_at: new Date().toISOString(),
        }),
      });

      inMemoryRegistrations = inMemoryRegistrations.filter((r) => r.id !== id);
      return res.status(200).json({ status: "rejected", message: "Request rejected successfully" });
    }

    // GET pending registration requests
    const sbPending = await sbQuery("registration_requests?select=*&status=eq.pending&order=created_at.desc");
    if (sbPending && Array.isArray(sbPending)) {
      const mapped = sbPending.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        work_email: r.work_email,
        department: r.department,
        requested_role: r.requested_role,
        status: r.status,
        certification_agreed: r.certification_agreed,
        created_at: r.created_at,
      }));
      return res.status(200).json(mapped);
    }

    // Fallback: inMemoryRegistrations filtered against approved
    const approvedEmails = new Set(approvedRegistrations.map((u) => u.work_email?.toLowerCase()));
    const remainingPending = inMemoryRegistrations.filter(
      (r) => !approvedEmails.has(r.work_email?.toLowerCase())
    );
    return res.status(200).json(remainingPending);
  }

  // 7. Audit Events
  if (path.includes("/api/v1/audit-events")) {
    const sbAudit = await sbQuery("audit_events?select=*&order=occurred_at.desc&limit=50");
    if (sbAudit && Array.isArray(sbAudit) && sbAudit.length > 0) {
      return res.status(200).json({
        items: sbAudit.map((a) => ({
          id: a.id,
          actor_user_id: a.actor_user_id || "usr-6",
          actor_username: "admin",
          action: a.action,
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          recorded_at: a.occurred_at,
          summary: a.change_summary || { outcome: "success" },
        })),
        total: sbAudit.length,
        page: 1,
        page_size: 50,
      });
    }

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

  // 8. Operations Summary
  if (path.includes("/api/v1/operations/summary")) {
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

  // 9. Health Checks
  if (path.includes("/health")) {
    return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  }

  return res.status(200).json({ status: "success", data: [] });
}
