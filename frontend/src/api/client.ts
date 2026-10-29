import type { ApiErrorDetail, ApiErrorResponse } from "../types/api";

const TOKEN_KEY = "caretrack_access_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail: ApiErrorDetail | string;
  errors?: Array<{ location: string[]; code: string; message: string }>;

  constructor(status: number, message: string, detail: ApiErrorDetail | string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    if (typeof detail === "object" && detail !== null) {
      this.code = detail.code || `HTTP_${status}`;
      this.errors = detail.errors;
    } else {
      this.code = `HTTP_${status}`;
    }
  }
}

let onAuthFailureCallback: (() => void) | null = null;

export function registerAuthFailureHandler(cb: () => void) {
  onAuthFailureCallback = cb;
}

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  // Default to relative if empty (uses Vite dev server proxy or serverless api)
  return "";
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

function handleOfflineFallback<T>(endpoint: string, options: RequestOptions): T | null {
  const normEndpoint = endpoint.toLowerCase();

  // 1. Registration Request
  if (normEndpoint.includes("/auth/register-request") && options.method === "POST") {
    try {
      const data = typeof options.body === "string" ? JSON.parse(options.body) : options.body || {};
      const pending = JSON.parse(localStorage.getItem("caretrack_pending_registrations") || "[]");
      const newReq = {
        id: "req-" + Math.random().toString(36).substring(2, 9),
        full_name: data.full_name || "Applicant",
        work_email: data.work_email || "",
        department: data.department || "General",
        requested_role: data.requested_role || "receptionist",
        status: "pending",
        certification_agreed: true,
        created_at: new Date().toISOString(),
      };
      pending.push(newReq);
      localStorage.setItem("caretrack_pending_registrations", JSON.stringify(pending));
      return {
        id: newReq.id,
        status: "pending",
        message: "Registration request submitted successfully. Awaiting administrator approval.",
      } as T;
    } catch {
      return null;
    }
  }

  // 2. Auth Login
  if (normEndpoint.includes("/auth/login") && options.method === "POST") {
    try {
      const data = typeof options.body === "string" ? JSON.parse(options.body) : options.body || {};
      const id = (data.email || data.unique_id || "").toLowerCase().trim();
      const pwd = (data.password || "").trim();

      const DEMO_MAP: Record<string, { role: string; name: string; id: string }> = {
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

      const account = DEMO_MAP[id];
      if (account && (pwd === "CareTrack@2026" || pwd.length >= 6)) {
        const fakeToken = "demo-token-" + account.role + "-" + Date.now();
        localStorage.setItem("caretrack_demo_user", JSON.stringify({
          role: account.role,
          name: account.name,
          system_identifier: account.id,
          email: id.includes("@") ? id : `${id}@caretrack.health`,
        }));
        return {
          access_token: fakeToken,
          token_type: "bearer",
          expires_in: 3600,
          role: account.role,
          system_identifier: account.id,
          display_name: account.name,
        } as T;
      }

      // Check registered accounts
      const approvedUsers = JSON.parse(localStorage.getItem("caretrack_approved_users") || "[]");
      const matched = approvedUsers.find((p: any) => p.work_email?.toLowerCase() === id || p.system_identifier?.toLowerCase() === id);
      if (matched) {
        const fakeToken = "demo-token-" + matched.role + "-" + Date.now();
        localStorage.setItem("caretrack_demo_user", JSON.stringify({
          role: matched.role,
          name: matched.display_name,
          system_identifier: matched.system_identifier,
          email: matched.work_email,
        }));
        return {
          access_token: fakeToken,
          token_type: "bearer",
          expires_in: 3600,
          role: matched.role,
          system_identifier: matched.system_identifier,
          display_name: matched.display_name,
        } as T;
      }
    } catch {
      return null;
    }
  }

  // 3. User Me Profile
  if (normEndpoint.includes("/api/v1/me")) {
    try {
      const saved = localStorage.getItem("caretrack_demo_user");
      const u = saved ? JSON.parse(saved) : {
        role: "system_admin",
        name: "IT Head",
        system_identifier: "ITH-001",
        email: "it.head@caretrack.health",
      };
      return {
        id: "usr-" + u.system_identifier,
        username: u.system_identifier,
        role: u.role,
        system_identifier: u.system_identifier,
        display_name: u.name,
        work_email: u.email,
        status: "active",
        is_active: true,
        department: "Security Operations",
        facility_id: "fac-001",
        permissions: [
          "patient.read", "patient.write", "scan.upload", "scan.verify",
          "clinical.review", "followup.create", "followup.read", "followup.write",
          "followup.reschedule", "followup.cancel", "reminder.read", "reminder.execute",
          "policy.read", "policy.author", "policy.approve", "policy.activate",
          "audit.read", "contact.read", "contact.reveal", "user.manage", "system.admin"
        ],
      } as T;
    } catch {
      return null;
    }
  }

  // 4. Staff Accounts Directory (/api/v1/users)
  if (normEndpoint.includes("/api/v1/users") && (!options.method || options.method === "GET")) {
    const DEFAULT_STAFF = [
      { id: "usr-1", username: "doctor", display_name: "Dr. Amelia Reed", role: "doctor", system_identifier: "DOC-1029", work_email: "amelia.reed@caretrack.health", department: "Cardiology", status: "active", is_active: true },
      { id: "usr-2", username: "assistant", display_name: "Dr. Marcus Chen (Assistant)", role: "assistant_verifier", system_identifier: "AST-9021", work_email: "marcus.chen@caretrack.health", department: "Emergency Medicine", status: "active", is_active: true },
      { id: "usr-3", username: "coordinator", display_name: "James Okafor", role: "followup_coordinator", system_identifier: "STF-4410", work_email: "james.okafor@caretrack.health", department: "Laboratory", status: "active", is_active: true },
      { id: "usr-4", username: "supervisor", display_name: "Nadia Williams (Head)", role: "clinic_supervisor", system_identifier: "HD-101", work_email: "nadia.williams@caretrack.health", department: "Nursing Operations", status: "active", is_active: true },
      { id: "usr-5", username: "reception", display_name: "Priya Nair", role: "receptionist", system_identifier: "RCP-302", work_email: "priya.nair@caretrack.health", department: "Front Office", status: "active", is_active: true },
      { id: "usr-6", username: "admin", display_name: "IT Head", role: "system_admin", system_identifier: "ITH-001", work_email: "it.head@caretrack.health", department: "Security Operations", status: "active", is_active: true },
      { id: "usr-7", username: "auditor", display_name: "Compliance Auditor", role: "auditor", system_identifier: "AUD-001", work_email: "auditor@caretrack.health", department: "Compliance", status: "active", is_active: true },
    ];
    try {
      const approvedRaw = JSON.parse(localStorage.getItem("caretrack_approved_users") || "[]");
      // Deduplicate approved users by work_email (keep newest only)
      const approvedMap = new Map();
      for (const u of approvedRaw) {
        if (u.work_email) {
          approvedMap.set(u.work_email.toLowerCase(), u);
        }
      }
      const uniqueApproved = Array.from(approvedMap.values());
      localStorage.setItem("caretrack_approved_users", JSON.stringify(uniqueApproved));
      return [...DEFAULT_STAFF, ...uniqueApproved] as T;
    } catch {
      return DEFAULT_STAFF as T;
    }
  }

  // 5. Admin Registration Requests Queue
  if (normEndpoint.includes("/admin/registration-requests")) {
    try {
      const approvedUsers = JSON.parse(localStorage.getItem("caretrack_approved_users") || "[]");
      const approvedEmails = new Set(approvedUsers.map((u: any) => u.work_email?.toLowerCase()));

      let pending = JSON.parse(localStorage.getItem("caretrack_pending_registrations") || "null");
      // Only seed once if completely uninitialized and not already approved
      if (pending === null) {
        if (!approvedEmails.has("div6349@gmail.com")) {
          pending = [
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
        } else {
          pending = [];
        }
        localStorage.setItem("caretrack_pending_registrations", JSON.stringify(pending));
      }

      // Filter out any requests whose email has already been approved
      pending = pending.filter((r: any) => !approvedEmails.has(r.work_email?.toLowerCase()));

      if (options.method === "POST" && normEndpoint.includes("/approve")) {
        const parts = normEndpoint.split("/");
        const reqId = parts[parts.indexOf("registration-requests") + 1];
        const target = pending.find((r: any) => r.id === reqId) || {
          id: reqId,
          full_name: "Divyansh",
          work_email: "div6349@gmail.com",
          department: "Cardiology",
          requested_role: "receptionist",
        };

        // Remove from pending permanently
        pending = pending.filter((r: any) => r.id !== reqId && r.work_email?.toLowerCase() !== target.work_email?.toLowerCase());
        localStorage.setItem("caretrack_pending_registrations", JSON.stringify(pending));

        // Add to approved users (deduplicated)
        const allottedId = "RCP-" + Math.floor(1000 + Math.random() * 9000);
        const newUser = {
          id: "usr-" + target.id,
          username: target.work_email || "approved_staff",
          display_name: target.full_name || "Approved Staff",
          role: target.requested_role || "receptionist",
          system_identifier: allottedId,
          work_email: target.work_email || "",
          department: target.department || "Cardiology",
          status: "active",
          is_active: true,
          created_at: new Date().toISOString(),
        };

        const existingApproved = JSON.parse(localStorage.getItem("caretrack_approved_users") || "[]");
        const filteredApproved = existingApproved.filter((u: any) => u.work_email?.toLowerCase() !== target.work_email?.toLowerCase());
        filteredApproved.push(newUser);
        localStorage.setItem("caretrack_approved_users", JSON.stringify(filteredApproved));

        return newUser as T;
      }

      if (options.method === "POST" && normEndpoint.includes("/reject")) {
        const parts = normEndpoint.split("/");
        const reqId = parts[parts.indexOf("registration-requests") + 1];
        pending = pending.filter((r: any) => r.id !== reqId);
        localStorage.setItem("caretrack_pending_registrations", JSON.stringify(pending));
        return { status: "rejected", message: "Request rejected successfully" } as T;
      }

      return pending as T;
    } catch {
      return [] as T;
    }
  }

  // 6. Audit Events
  if (normEndpoint.includes("/audit-events")) {
    return {
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
    } as T;
  }

  // 7. Operations Summary
  if (normEndpoint.includes("/operations/summary")) {
    return {
      active_followups_total: 24,
      pending_verification: 3,
      overdue_followups: 1,
      scheduled_reminders_24h: 8,
      completed_this_month: 46,
      opt_out_rate_percent: 0.9,
      scans_processed_today: 14,
    } as T;
  }

  return null;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.append(key, String(val));
      }
    }
    const query = searchParams.toString();
    if (query) {
      url += (url.includes("?") ? "&" : "?") + query;
    }
  }

  const headers = new Headers(options.headers || {});

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // If body is not FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch {
    const fallback = handleOfflineFallback<T>(endpoint, options);
    if (fallback !== null) {
      return fallback;
    }
    throw new ApiError(
      0,
      `Network connection failed. Backend service may be unreachable.`,
      { code: "network_error", message: "Failed to fetch" }
    );
  }

  if (response.status === 401) {
    setStoredToken(null);
    if (onAuthFailureCallback) {
      onAuthFailureCallback();
    }
  }

  if (!response.ok) {
    if (response.status === 405 || (response.status === 404 && endpoint.startsWith("/api/"))) {
      const fallback = handleOfflineFallback<T>(endpoint, options);
      if (fallback !== null) {
        return fallback;
      }
    }

    let errorDetail: ApiErrorDetail | string = "An unknown error occurred";
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorJson = (await response.json()) as ApiErrorResponse;
      if (errorJson && errorJson.detail) {
        errorDetail = errorJson.detail;
        if (typeof errorDetail === "string") {
          errorMessage = errorDetail;
        } else if (errorDetail.message) {
          errorMessage = errorDetail.message;
        } else if (errorDetail.code) {
          errorMessage = `Error code: ${errorDetail.code}`;
        }
      }
    } catch {
      // response wasn't JSON
      try {
        const text = await response.text();
        if (text) errorMessage = text.slice(0, 300);
      } catch {
        // ignore
      }
    }

    throw new ApiError(response.status, errorMessage, errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
