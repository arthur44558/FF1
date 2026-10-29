import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import SiteHeader from "./components/SiteHeader";
import FeedbackDialog from "./components/FeedbackDialog";
import HeroSection from "./sections/HeroSection";
import ProductSections from "./sections/ProductSections";
import WorkflowSection from "./sections/WorkflowSection";
import AboutFooter from "./sections/AboutFooter";
import { AppHeader, type ActiveTab } from "./components/layout/AppHeader";
import { LoginModal } from "./components/auth/LoginModal";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ScanIntakeScreen } from "./screens/ScanIntakeScreen";
import { FollowupsScreen } from "./screens/FollowupsScreen";
import { RemindersScreen } from "./screens/RemindersScreen";
import { PatientsScreen } from "./screens/PatientsScreen";
import { PoliciesScreen } from "./screens/PoliciesScreen";
import { UsersScreen } from "./screens/UsersScreen";
import { ArrowRight, LayoutDashboard } from "lucide-react";

function CareTrackMain() {
  const { user } = useAuth();

  // Mode: "landing" (marketing/public) or "app" (authenticated clinical workflow)
  const [viewMode, setViewMode] = useState<"landing" | "app">(() => {
    return localStorage.getItem("caretrack_view_mode") === "landing" ? "landing" : "app";
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [tabParams, setTabParams] = useState<any>({});
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // If user logs in while on landing, switch to app mode unless user explicitly selected landing
  useEffect(() => {
    if (user && viewMode === "landing" && !localStorage.getItem("caretrack_stay_on_landing")) {
      setViewMode("app");
    }
  }, [user, viewMode]);

  const handleNavigate = (tab: ActiveTab, params?: any) => {
    setActiveTab(tab);
    setTabParams(params || {});
    setViewMode("app");
  };

  const handleOpenAuth = () => {
    if (user) {
      setViewMode("app");
    } else {
      setLoginModalOpen(true);
    }
  };

  const handleGoHome = () => {
    localStorage.setItem("caretrack_stay_on_landing", "true");
    setViewMode("landing");
  };

  return (
    <>
      {viewMode === "landing" || !user ? (
        // Public Marketing Landing Page
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
          <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

          {/* Quick workspace jump pill if authenticated */}
          {user && (
            <div className="fixed bottom-5 right-5 z-40 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("caretrack_stay_on_landing");
                  setViewMode("app");
                }}
                className="flex items-center gap-2 rounded-full bg-[#0c4b80] px-5 py-3 text-xs font-bold text-white shadow-xl hover:bg-[#08355c] transition"
              >
                <LayoutDashboard className="size-4" />
                <span>Return to Clinical Workspace ({user.username})</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Authenticated Clinical Workspace
        <div className="min-h-screen bg-[#f4f7fb] text-[#17212b]">
          <AppHeader
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setTabParams({});
            }}
            onGoHome={handleGoHome}
          />

          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {activeTab === "dashboard" && (
              <DashboardScreen onNavigate={handleNavigate} />
            )}

            {activeTab === "scans" && (
              <ScanIntakeScreen
                initialScanId={tabParams?.scanId}
                onNavigateToFollowup={(foId) => handleNavigate("followups", { selectedId: foId })}
              />
            )}

            {activeTab === "followups" && (
              <FollowupsScreen
                initialSelectedId={tabParams?.selectedId}
                initialOverdue={tabParams?.overdue}
              />
            )}

            {activeTab === "reminders" && (
              <RemindersScreen
                initialJobId={tabParams?.selectedJobId}
                initialStatus={tabParams?.status}
              />
            )}

            {activeTab === "patients" && <PatientsScreen />}

            {activeTab === "policies" && <PoliciesScreen />}

            {activeTab === "users" && <UsersScreen />}
          </main>
        </div>
      )}

      {/* Login Modal */}
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
