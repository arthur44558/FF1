import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import SiteHeader from "./components/SiteHeader";
import FeedbackDialog from "./components/FeedbackDialog";
import HeroSection from "./sections/HeroSection";
import ProductSections from "./sections/ProductSections";
import WorkflowSection from "./sections/WorkflowSection";
import AboutFooter from "./sections/AboutFooter";
import { LoginModal } from "./components/auth/LoginModal";

// Role-specific screens integrated from source ZIPs
import { DoctorDashboardScreen } from "./screens/DoctorDashboardScreen";
import { AssistantIntakeScreen } from "./screens/AssistantIntakeScreen";
import { ReceptionDeskScreen } from "./screens/ReceptionDeskScreen";
import { CoordinatorTriageScreen } from "./screens/CoordinatorTriageScreen";
import { StaffHeadDashboardScreen } from "./screens/StaffHeadDashboardScreen";
import { ITHeadAdminScreen } from "./screens/ITHeadAdminScreen";
import { AuditorScreen } from "./screens/AuditorScreen";

import { ArrowRight, LayoutDashboard } from "lucide-react";

function CareTrackMain() {
  const { user } = useAuth();

  // Mode: "landing" (marketing/public) or "app" (authenticated clinical role workspace)
  const [viewMode, setViewMode] = useState<"landing" | "app">(() => {
    return localStorage.getItem("caretrack_stay_on_landing") === "true"
      ? "landing"
      : "app";
  });

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // If user logs in while on landing, automatically switch to role dashboard
  useEffect(() => {
    if (user && !localStorage.getItem("caretrack_stay_on_landing")) {
      setViewMode("app");
    }
  }, [user]);

  const handleOpenAuth = () => {
    if (user) {
      localStorage.removeItem("caretrack_stay_on_landing");
      setViewMode("app");
    } else {
      setLoginModalOpen(true);
    }
  };

  const handleGoHome = () => {
    localStorage.setItem("caretrack_stay_on_landing", "true");
    setViewMode("landing");
  };

  const handleReturnToWorkspace = () => {
    localStorage.removeItem("caretrack_stay_on_landing");
    setViewMode("app");
  };

  // Authoritative Role Dispatcher: Strictly routes according to user.role from GET /api/v1/me
  const renderRoleWorkspace = () => {
    if (!user) return null;

    switch (user.role) {
      case "doctor":
        return <DoctorDashboardScreen onGoHome={handleGoHome} />;
      case "assistant_verifier":
        return <AssistantIntakeScreen onGoHome={handleGoHome} />;
      case "receptionist":
        return <ReceptionDeskScreen onGoHome={handleGoHome} />;
      case "followup_coordinator":
        return <CoordinatorTriageScreen onGoHome={handleGoHome} />;
      case "clinic_supervisor":
        return <StaffHeadDashboardScreen onGoHome={handleGoHome} />;
      case "system_admin":
        return <ITHeadAdminScreen onGoHome={handleGoHome} />;
      case "auditor":
        return <AuditorScreen onGoHome={handleGoHome} />;
      default:
        return <DoctorDashboardScreen onGoHome={handleGoHome} />;
    }
  };

  return (
    <>
      {viewMode === "landing" || !user ? (
        // Public Marketing Landing Page (caretrack.zip)
        <div className="min-h-screen bg-[#f7faff]">
          <SiteHeader
            onFeedback={() => setFeedbackOpen(true)}
            onLogin={handleOpenAuth}
            onGetStarted={handleOpenAuth}
          />
          <main>
            <HeroSection onGetStarted={handleOpenAuth} />
            <ProductSections />
            <WorkflowSection />
            <AboutFooter
              onFeedback={() => setFeedbackOpen(true)}
              onGetStarted={handleOpenAuth}
            />
          </main>
          <FeedbackDialog
            open={feedbackOpen}
            onClose={() => setFeedbackOpen(false)}
          />

          {/* Quick workspace jump pill if authenticated */}
          {user && (
            <div className="fixed bottom-5 right-5 z-40 animate-fade-in">
              <button
                type="button"
                onClick={handleReturnToWorkspace}
                className="flex items-center gap-2 rounded-full bg-[#0c4b80] px-5 py-3 text-xs font-bold text-white shadow-xl hover:bg-[#08355c] transition"
              >
                <LayoutDashboard className="size-4" />
                <span>
                  Return to Workspace ({user.system_identifier || user.username})
                </span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Authoritative Role Dashboard (doctor, assistant, receptionist, triage, staff head, it-head, auditor)
        renderRoleWorkspace()
      )}

      {/* Login / Registration Modal (login page1.zip) */}
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          localStorage.removeItem("caretrack_stay_on_landing");
          setViewMode("app");
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CareTrackMain />
      </AuthProvider>
    </ToastProvider>
  );
}
