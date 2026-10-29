import React, { useState, type FormEvent } from "react";
import {
  BadgeCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  UserRound,
  Mail,
  Building2,
  CheckCircle2,
  X,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { forgotPassword, requestRegistration, resetPassword } from "../../api/auth";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthTab = "signin" | "register";

type RegistrationData = {
  fullName: string;
  email: string;
  department: string;
  requestedRole: string;
  password: string;
  confirmPassword: string;
  certified: boolean;
};

export const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, onSuccess }) => {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>("signin");

  // Sign-in state
  const [uniqueId, setUniqueId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberId, setRememberId] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset" | "success">("request");
  const [forgotIdentity, setForgotIdentity] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotPassVisible, setForgotPassVisible] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [forgotDelivery, setForgotDelivery] = useState<string | null>(null);

  // Registration state
  const [regData, setRegData] = useState<RegistrationData>({
    fullName: "",
    email: "",
    department: "",
    requestedRole: "doctor",
    password: "",
    confirmPassword: "",
    certified: false,
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);
  const [regSuccessModal, setRegSuccessModal] = useState<boolean>(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  if (!open) return null;

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = uniqueId.trim();
    if (!cleanId || !password) {
      setErrorMessage("Invalid Unique ID or Access Revoked");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(cleanId, password.trim());
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (err.status === 429) {
        setErrorMessage(err.message || "Too many login attempts. Please wait.");
      } else if (err.status === 0) {
        setErrorMessage("Network error. Backend service is unreachable.");
      } else if (err.code === "session_error") {
        setErrorMessage("Authentication succeeded, but failed to load user profile.");
      } else {
        setErrorMessage("Invalid Unique ID or Access Revoked");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistration = async (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!regData.fullName.trim()) errors.fullName = "Full name is required";
    if (!regData.email.trim() || !regData.email.includes("@")) errors.email = "Valid work email is required";
    if (!regData.department.trim()) errors.department = "Department/Specialty is required";
    if (!regData.password || regData.password.length < 8) errors.password = "Password must be at least 8 characters";
    if (regData.password !== regData.confirmPassword) errors.confirmPassword = "Passwords do not match";
    if (!regData.certified) errors.certified = "You must certify authorization to request access";

    setRegErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsRegSubmitting(true);
    setErrorMessage(null);

    try {
      await requestRegistration({
        full_name: regData.fullName.trim(),
        work_email: regData.email.trim(),
        department: regData.department.trim(),
        requested_role: regData.requestedRole,
        password: regData.password,
        certification_agreed: regData.certified,
      });

      setRegisteredEmail(regData.email.trim());
      setRegSuccessModal(true);
      setRegData({
        fullName: "",
        email: "",
        department: "",
        requestedRole: "doctor",
        password: "",
        confirmPassword: "",
        certified: false,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit registration request. Please verify fields.");
    } finally {
      setIsRegSubmitting(false);
    }
  };

  const handleForgotRequest = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    const id = forgotIdentity.trim();
    if (!id) {
      setForgotError("Please enter your Unique ID or Registered Work Email.");
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await forgotPassword(id);
      setForgotDelivery(res.delivery);
      setForgotSuccessMsg(res.message);
      if (res.reset_token) {
        setForgotToken(res.reset_token);
      }
      setForgotStep("reset");
    } catch (err: any) {
      setForgotError(err.message || "Unable to initiate reset request. Please check your details.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!forgotToken.trim()) {
      setForgotError("Reset token is required.");
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError("New password must be at least 8 characters.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await resetPassword(forgotToken.trim(), forgotNewPassword.trim());
      setForgotSuccessMsg(res.message);
      setForgotStep("success");
    } catch (err: any) {
      setForgotError(err.message || "Invalid or expired reset token.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c4b80]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0c4b80] to-[#183d63] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-[#25aea8]">
              <ShieldCheck className="size-6 text-[#25aea8]" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">CareTrack Workspace</h2>
              <p className="text-xs text-slate-200">Authorized Clinical Healthcare Access</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 bg-white/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "signin"
                  ? "bg-white text-[#0c4b80] shadow-sm"
                  : "text-slate-200 hover:text-white hover:bg-white/5"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-white text-[#0c4b80] shadow-sm"
                  : "text-slate-200 hover:text-white hover:bg-white/5"
              }`}
            >
              Request Account
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {activeTab === "signin" ? (
            /* SIGN IN FORM (login page1.zip design) */
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="signin-unique-id">
                  Generated Unique ID
                </label>
                <div className="relative">
                  <BadgeCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    id="signin-unique-id"
                    type="text"
                    required
                    value={uniqueId}
                    onChange={(e) => setUniqueId(e.target.value)}
                    placeholder="e.g. DOC-1029, AST-9021, STF-4410, ITH-001"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80] focus:border-transparent transition-all uppercase placeholder:normal-case font-mono"
                    spellCheck={false}
                    autoComplete="username"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Enter the Unique ID issued to you by the IT administrator upon approval.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="signin-password">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    id="signin-password"
                    type={passwordVisible ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80] focus:border-transparent transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                  >
                    {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberId}
                    onChange={(e) => setRememberId(e.target.checked)}
                    className="rounded border-slate-300 text-[#0c4b80] focus:ring-[#0c4b80]"
                  />
                  <span>Remember ID on this device</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotIdentity(uniqueId.trim());
                    setForgotStep("request");
                    setForgotError(null);
                    setShowForgot(true);
                  }}
                  className="font-medium text-[#0c4b80] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-[#c94e08] hover:bg-[#b04406] active:bg-[#973a05] text-white font-semibold text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? "Checking Unique ID…" : "Sign In to Workspace"}</span>
                {!isSubmitting && <ArrowRight className="size-4" />}
              </button>

              {/* Seed Demo Quick Help */}
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <LockKeyhole className="size-3 text-slate-500" />
                  Pre-Provisioned Demo Unique IDs (Password: <code>CareTrack@2026</code>)
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-600">
                  <button
                    type="button"
                    onClick={() => {
                      setUniqueId("DOC-1029");
                      setPassword("CareTrack@2026");
                    }}
                    className="text-left p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  >
                    • <strong>DOC-1029</strong> (Doctor)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUniqueId("AST-9021");
                      setPassword("CareTrack@2026");
                    }}
                    className="text-left p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  >
                    • <strong>AST-9021</strong> (Assistant)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUniqueId("STF-4410");
                      setPassword("CareTrack@2026");
                    }}
                    className="text-left p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  >
                    • <strong>STF-4410</strong> (Coordinator)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUniqueId("HD-101");
                      setPassword("CareTrack@2026");
                    }}
                    className="text-left p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  >
                    • <strong>HD-101</strong> (Staff Head)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUniqueId("RCP-302");
                      setPassword("CareTrack@2026");
                    }}
                    className="text-left p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  >
                    • <strong>RCP-302</strong> (Reception)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUniqueId("ITH-001");
                      setPassword("CareTrack@2026");
                    }}
                    className="text-left p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  >
                    • <strong>ITH-001</strong> (IT Admin)
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* REQUEST ACCOUNT FORM (login page1.zip design) */
            <form onSubmit={handleRegistration} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regData.fullName}
                    onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                    placeholder="e.g. Dr. Aditi Mehra"
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                  />
                </div>
                {regErrors.fullName && <p className="text-[11px] text-rose-600 mt-1">{regErrors.fullName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    placeholder="name@hospital.org"
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                  />
                </div>
                {regErrors.email && <p className="text-[11px] text-rose-600 mt-1">{regErrors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department / Specialty</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regData.department}
                      onChange={(e) => setRegData({ ...regData, department: e.target.value })}
                      placeholder="e.g. Cardiology"
                      className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                    />
                  </div>
                  {regErrors.department && <p className="text-[11px] text-rose-600 mt-1">{regErrors.department}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Role</label>
                  <select
                    value={regData.requestedRole}
                    onChange={(e) => setRegData({ ...regData, requestedRole: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80] bg-white"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="assistant_doctor">Assistant Doctor</option>
                    <option value="staff_head">Staff Head</option>
                    <option value="staff">Staff</option>
                    <option value="receptionist">Receptionist</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                  />
                  {regErrors.password && <p className="text-[11px] text-rose-600 mt-1">{regErrors.password}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={regData.confirmPassword}
                    onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                  />
                  {regErrors.confirmPassword && (
                    <p className="text-[11px] text-rose-600 mt-1">{regErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regData.certified}
                  onChange={(e) => setRegData({ ...regData, certified: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-[#0c4b80] focus:ring-[#0c4b80]"
                />
                <span>
                  I certify that I am an authorized healthcare professional requesting access for official hospital
                  duties under clinic security policies.
                </span>
              </label>
              {regErrors.certified && <p className="text-[11px] text-rose-600">{regErrors.certified}</p>}

              <button
                type="submit"
                disabled={isRegSubmitting}
                className="w-full py-2.5 px-4 bg-[#0c4b80] hover:bg-[#0a3e6a] text-white font-semibold text-sm rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isRegSubmitting ? "Submitting Request…" : "Submit Access Request"}</span>
                <ArrowRight className="size-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Registration Request Pending */}
      {regSuccessModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center">
            <span className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="size-8" />
            </span>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Access Request Submitted</h3>
            <p className="text-xs text-slate-600 mb-4">
              Your request for <strong>{registeredEmail}</strong> has been saved with <strong>Pending</strong> status.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-700 mb-5 space-y-1">
              <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                <FileCheck2 className="size-4 text-[#0c4b80]" /> Administrator Verification Required
              </p>
              <p>• Your account is not active yet.</p>
              <p>• An IT administrator will review and verify your authorization.</p>
              <p>• Upon approval, your <strong>Generated Unique ID</strong> will be issued to sign in.</p>
            </div>
            <button
              onClick={() => {
                setRegSuccessModal(false);
                setActiveTab("signin");
              }}
              className="w-full py-2.5 bg-[#0c4b80] hover:bg-[#0a3e6a] text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      )}

      {/* Forgot Password / Password Reset Flow */}
      {showForgot && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => {
                setShowForgot(false);
                setForgotStep("request");
                setForgotError(null);
              }}
              className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>

            {forgotStep === "request" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center size-10 rounded-xl bg-[#0c4b80]/10 text-[#0c4b80]">
                    <KeyRound className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Forgot Password</h3>
                    <p className="text-xs text-slate-500">CareTrack & Supabase Identity Recovery</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Enter your <strong>Unique ID</strong> (e.g. DOC-1029) or registered <strong>Work Email</strong>.
                  Reset instructions will be delivered to you or generated for authorized accounts.
                </p>

                {forgotError && (
                  <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="forgot-identity">
                      Unique ID or Work Email
                    </label>
                    <div className="relative">
                      <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        id="forgot-identity"
                        type="text"
                        required
                        value={forgotIdentity}
                        onChange={(e) => setForgotIdentity(e.target.value)}
                        placeholder="e.g. DOC-1029 or amelia.reed@caretrack.health"
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotSubmitting}
                      className="flex-1 py-2.5 px-4 bg-[#0c4b80] hover:bg-[#0a3e6a] text-white font-semibold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>{forgotSubmitting ? "Verifying…" : "Continue"}</span>
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {forgotStep === "reset" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center size-10 rounded-xl bg-[#c94e08]/10 text-[#c94e08]">
                    <LockKeyhole className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Set New Password</h3>
                    <p className="text-xs text-slate-500">Provide reset token & new credential</p>
                  </div>
                </div>

                {forgotSuccessMsg && (
                  <div className="p-3 mb-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-800 leading-relaxed">
                    {forgotSuccessMsg}
                    {forgotDelivery === "direct_token" && forgotToken && (
                      <span className="block mt-1 font-semibold text-sky-900">
                        (Active reset token prefilled below for local verification)
                      </span>
                    )}
                  </div>
                )}

                {forgotError && (
                  <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleResetSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="reset-token">
                      Reset Token
                    </label>
                    <input
                      id="reset-token"
                      type="text"
                      required
                      value={forgotToken}
                      onChange={(e) => setForgotToken(e.target.value)}
                      placeholder="Paste reset token here"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="new-password">
                      New Password (min 8 characters)
                    </label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        id="new-password"
                        type={forgotPassVisible ? "text" : "password"}
                        required
                        minLength={8}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="Enter new strong password"
                        className="w-full pl-10 pr-10 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                      />
                      <button
                        type="button"
                        onClick={() => setForgotPassVisible(!forgotPassVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        {forgotPassVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="confirm-new-password">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-new-password"
                      type={forgotPassVisible ? "text" : "password"}
                      required
                      minLength={8}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0c4b80]"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep("request")}
                      className="flex-1 py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={forgotSubmitting}
                      className="flex-2 py-2 px-4 bg-[#c94e08] hover:bg-[#b04406] text-white font-semibold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span>{forgotSubmitting ? "Updating Password…" : "Update Password"}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {forgotStep === "success" && (
              <div className="text-center py-2">
                <span className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                  <CheckCircle2 className="size-8" />
                </span>
                <h3 className="text-base font-bold text-slate-900 mb-1">Password Successfully Updated</h3>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  Your new credentials have been safely synchronized across CareTrack and Supabase Auth. You can now log
                  in using your new password.
                </p>
                <button
                  onClick={() => {
                    setShowForgot(false);
                    setForgotStep("request");
                    setForgotError(null);
                    setPassword("");
                    if (forgotIdentity) {
                      setUniqueId(forgotIdentity);
                    }
                  }}
                  className="w-full py-2.5 bg-[#0c4b80] hover:bg-[#0a3e6a] text-white font-semibold text-sm rounded-xl transition-colors shadow"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
