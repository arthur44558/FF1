import React, { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Play,
  AlertTriangle,
  XCircle,
  FileText,
  Eye,
  Stethoscope,
  UserCheck,
  RefreshCw,
  Lock,
  AlertCircle,
} from "lucide-react";
import {
  uploadScan,
  processScan,
  getScanReview,
  fetchScanImageBlob,
  recordDecision,
  verifyScan,
} from "../api/scans";
import { lookupPatient } from "../api/patients";
import { lookupEncounter } from "../api/encounters";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge } from "../components/common/Badge";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import type {
  ClinicalDecisionIn,
  ScanReviewOut,
  Severity,
  VerificationIn,
} from "../types/api";

interface ScanIntakeScreenProps {
  initialScanId?: string;
  onNavigateToFollowup?: (followupId: string) => void;
}

export const ScanIntakeScreen: React.FC<ScanIntakeScreenProps> = ({
  initialScanId,
  onNavigateToFollowup,
}) => {
  const { hasPermission, hasRole } = useAuth();
  const { addToast } = useToast();

  // Scan state
  const [scanId, setScanId] = useState<string>(initialScanId || "");
  const [scanData, setScanData] = useState<ScanReviewOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [formIdentifier, setFormIdentifier] = useState(
    `FORM-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [formVersion, setFormVersion] = useState("clinic-form-v1");
  const [uploading, setUploading] = useState(false);

  // Image Modal State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  // Clinician Decision Form State (Doctor only)
  const [decRequired, setDecRequired] = useState(true);
  const [decSeverity, setDecSeverity] = useState<Severity>("normal");
  const [decDateTime, setDecDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [decTimezone, setDecTimezone] = useState("Asia/Kolkata");
  const [decReason, setDecReason] = useState("Standard post-discharge follow-up order");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Assistant Verification Form State (Assistant Verifier only)
  const [verResult, setVerResult] = useState<"verified" | "clarification_required" | "rejected">("verified");
  const [verPatientId, setVerPatientId] = useState("TEST-PATIENT-001");
  const [verEncounterId, setVerEncounterId] = useState("TEST-ENCOUNTER-001");
  const [verRequired, setVerRequired] = useState(true);
  const [verSeverity, setVerSeverity] = useState<Severity>("normal");
  const [verDateTime, setVerDateTime] = useState("");
  const [verTimezone, setVerTimezone] = useState("Asia/Kolkata");
  const [verReason, setVerReason] = useState("Verified patient identity, encounter and clinical order");
  const [verCorrectionSummary, setVerCorrectionSummary] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);

  // Validation feedback
  const [patientLookupStatus, setPatientLookupStatus] = useState<string | null>(null);
  const [encounterLookupStatus, setEncounterLookupStatus] = useState<string | null>(null);

  const loadScanDetails = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const review = await getScanReview(id);
      setScanData(review);

      // Pre-fill verification form from clinician decision if available
      if (review.clinical_decision) {
        setVerRequired(review.clinical_decision.followup_required);
        if (review.clinical_decision.severity) {
          setVerSeverity(review.clinical_decision.severity);
        }
        if (review.clinical_decision.scheduled_at) {
          const d = new Date(review.clinical_decision.scheduled_at);
          setVerDateTime(d.toISOString().slice(0, 16));
        }
        if (review.clinical_decision.timezone) {
          setVerTimezone(review.clinical_decision.timezone);
        }
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialScanId) {
      setScanId(initialScanId);
      loadScanDetails(initialScanId);
    }
  }, [initialScanId, loadScanDetails]);

  // Handle Upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      addToast("error", "Please select a scan image file (JPEG, PNG, or WebP).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadScan(file, formIdentifier, formVersion);
      setScanId(uploaded.id);
      addToast("success", `Scan uploaded: ${uploaded.form_identifier}`, "Upload Success");
      await loadScanDetails(uploaded.id);
    } catch (err: any) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  // Handle Process
  const handleProcess = async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    try {
      const processed = await processScan(scanId);
      addToast("info", `Processing state: ${processed.processing_status}`, "Processing Queued");
      await loadScanDetails(scanId);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Load Scan Image
  const handleViewImage = async () => {
    if (!scanId) return;
    setImageLoading(true);
    try {
      const blob = await fetchScanImageBlob(scanId);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setShowImageModal(true);
    } catch (err: any) {
      addToast("error", err.message || "Failed to load scan image");
    } finally {
      setImageLoading(false);
    }
  };

  // Submit Clinician Decision (Doctor)
  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanId) return;
    setSubmittingDecision(true);
    setError(null);
    try {
      const payload: ClinicalDecisionIn = {
        followup_required: decRequired,
        severity: decRequired ? decSeverity : null,
        scheduled_at_local: decRequired ? decDateTime : null,
        timezone: decTimezone,
        reason: decReason,
      };
      await recordDecision(scanId, payload);
      addToast("success", "Clinician decision recorded.", "Doctor Decision Saved");
      await loadScanDetails(scanId);
    } catch (err: any) {
      setError(err);
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Validate patient identifier
  const handleVerifyPatientLookup = async () => {
    if (!verPatientId) return;
    setPatientLookupStatus("Checking...");
    try {
      const p = await lookupPatient(verPatientId);
      setPatientLookupStatus(`✓ Found patient: ${p.display_name || p.hospital_patient_identifier}`);
    } catch (err: any) {
      setPatientLookupStatus("✗ Patient identifier not found in clinic records");
    }
  };

  // Validate encounter identifier
  const handleVerifyEncounterLookup = async () => {
    if (!verEncounterId) return;
    setEncounterLookupStatus("Checking...");
    try {
      const enc = await lookupEncounter(verEncounterId);
      setEncounterLookupStatus(`✓ Found encounter: ${enc.external_encounter_identifier}`);
    } catch (err: any) {
      setEncounterLookupStatus("✗ Encounter identifier not found in clinic records");
    }
  };

  // Submit Assistant Verification (Assistant Verifier)
  const handleVerifyScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanId) return;
    setSubmittingVerification(true);
    setError(null);
    try {
      let corrections: Record<string, any> | null = null;
      if (verCorrectionSummary.trim()) {
        try {
          corrections = JSON.parse(verCorrectionSummary);
        } catch {
          corrections = { notes: verCorrectionSummary };
        }
      }

      const payload: VerificationIn = {
        result: verResult,
        patient_identifier: verResult === "verified" ? verPatientId : null,
        encounter_identifier: verResult === "verified" ? verEncounterId : null,
        followup_required: verResult === "verified" ? verRequired : null,
        severity: verResult === "verified" && verRequired ? verSeverity : null,
        scheduled_at_local: verResult === "verified" && verRequired ? verDateTime : null,
        timezone: verResult === "verified" ? verTimezone : null,
        correction_summary: corrections,
        reason: verReason,
      };

      const res = await verifyScan(scanId, payload);
      addToast("success", res.message, `Scan ${res.scan_status}`);
      await loadScanDetails(scanId);

      if (res.followup_id && onNavigateToFollowup) {
        onNavigateToFollowup(res.followup_id);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setSubmittingVerification(false);
    }
  };

  const status = scanData?.processing_status;
  const hasDoctorDecision = Boolean(scanData?.clinical_decision);
  const isDoctor = hasRole("doctor");
  const isAssistant = hasRole("assistant_verifier");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebf3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#183d63]">Scan Intake & Verification</h1>
          <p className="text-xs text-[#667c91] mt-0.5">
            Strict human-in-the-loop decision tree: Assistant uploads &rarr; Processing &rarr; Doctor authorizes &rarr; Assistant verifies matching records.
          </p>
        </div>
        {scanId && (
          <button
            type="button"
            onClick={() => loadScanDetails(scanId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e0e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#45627f] hover:bg-[#f7faff] transition"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Scan
          </button>
        )}
      </div>

      {error && <ErrorBanner error={error} />}

      {/* Decision Tree State Stepper */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div
          className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            scanData
              ? "border-[#81d8b1] bg-[#f2fcf7] text-[#0d543a]"
              : "border-[#d8e0e7] bg-white text-[#788ca0]"
          }`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-xs shadow-xs">
            1
          </span>
          <div>
            <p className="font-bold">Scan Upload</p>
            <p className="text-[10px]">{scanData ? "Completed" : "Pending upload"}</p>
          </div>
        </div>

        <div
          className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            status === "needs_review"
              ? "border-[#81d8b1] bg-[#f2fcf7] text-[#0d543a]"
              : status === "processing_failed"
              ? "border-[#fda29b] bg-[#fef3f2] text-[#b42318]"
              : scanData
              ? "border-[#bfe2df] bg-[#eaf5f4] text-[#1e6b66]"
              : "border-[#d8e0e7] bg-white text-[#788ca0]"
          }`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-xs shadow-xs">
            2
          </span>
          <div>
            <p className="font-bold">OMR / OCR Processing</p>
            <p className="text-[10px]">
              {status === "processing_failed"
                ? "Processing failed"
                : status === "needs_review"
                ? "Ready for review"
                : status || "Waiting"}
            </p>
          </div>
        </div>

        <div
          className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            hasDoctorDecision
              ? "border-[#81d8b1] bg-[#f2fcf7] text-[#0d543a]"
              : status === "needs_review"
              ? "border-[#fcd38d] bg-[#fffcf4] text-[#975a16]"
              : "border-[#d8e0e7] bg-white text-[#788ca0]"
          }`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-xs shadow-xs">
            3
          </span>
          <div>
            <p className="font-bold">Doctor Decision</p>
            <p className="text-[10px]">
              {hasDoctorDecision ? "Clinician Authorized" : "Doctor required"}
            </p>
          </div>
        </div>

        <div
          className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            status === "verified"
              ? "border-[#81d8b1] bg-[#f2fcf7] text-[#0d543a]"
              : status === "clarification_required"
              ? "border-[#fcd38d] bg-[#fffcf4] text-[#975a16]"
              : status === "rejected"
              ? "border-[#fda29b] bg-[#fef3f2] text-[#b42318]"
              : "border-[#d8e0e7] bg-white text-[#788ca0]"
          }`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-xs shadow-xs">
            4
          </span>
          <div>
            <p className="font-bold">Assistant Verification</p>
            <p className="text-[10px]">
              {status === "verified"
                ? "Order Verified"
                : status === "clarification_required"
                ? "Clarification required"
                : status === "rejected"
                ? "Scan rejected"
                : "Awaiting verification"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Workflow Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Upload & Scan Details */}
        <div className="space-y-6">
          {/* Step 1: Upload Scan */}
          <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#eaf0f6]">
              <Upload className="size-4 text-[#0c4b80]" />
              <h2 className="text-sm font-bold text-[#183d63]">1. Upload Form Scan</h2>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Scan Image File (JPEG, PNG, WebP)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#516d89] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#edf5fb] file:text-[#0c4b80] hover:file:bg-[#e0effa]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Form Identifier
                  </label>
                  <input
                    type="text"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    required
                    maxLength={120}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-2 text-xs text-[#17212b]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Form Version
                  </label>
                  <input
                    type="text"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    required
                    maxLength={40}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-2 text-xs text-[#17212b]"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-[#788ca0]">
                  Max file size: 12MB. File is stored securely.
                </span>
                <button
                  type="submit"
                  disabled={uploading || !file || !hasPermission("scan:upload")}
                  className="rounded-full bg-[#0c4b80] px-5 py-2 text-xs font-bold text-white hover:bg-[#08355c] transition disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload Scan"}
                </button>
              </div>
            </form>
          </div>

          {/* Scan Record Details & Review */}
          {scanData && (
            <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#0c4b80]" />
                  <h2 className="text-sm font-bold text-[#183d63]">Scan Document Details</h2>
                </div>
                <Badge
                  variant={
                    status === "verified"
                      ? "completed"
                      : status === "needs_review"
                      ? "info"
                      : status === "processing_failed"
                      ? "severe"
                      : "default"
                  }
                >
                  {status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#788ca0] block">Form Identifier</span>
                  <span className="font-mono font-bold text-[#183d63]">
                    {scanData.form_identifier}
                  </span>
                </div>
                <div>
                  <span className="text-[#788ca0] block">Form Version</span>
                  <span className="font-medium text-[#183d63]">{scanData.form_version}</span>
                </div>
                <div>
                  <span className="text-[#788ca0] block">SHA-256 Digest</span>
                  <span className="font-mono text-[10px] text-[#516d89] truncate block" title={scanData.sha256}>
                    {scanData.sha256.slice(0, 16)}...
                  </span>
                </div>
                <div>
                  <span className="text-[#788ca0] block">Uploaded At</span>
                  <span className="text-[#516d89]">
                    {new Date(scanData.uploaded_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action buttons for scan */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#eaf0f6]">
                {hasPermission("scan:process") &&
                  (status === "uploaded" || status === "processing_failed") && (
                    <button
                      type="button"
                      onClick={handleProcess}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0c4b80] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#08355c] transition"
                    >
                      <Play className="size-3" /> Queue Processing
                    </button>
                  )}

                <button
                  type="button"
                  onClick={handleViewImage}
                  disabled={imageLoading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#0c4b80] hover:bg-[#f7faff] transition"
                >
                  <Eye className="size-3.5" /> {imageLoading ? "Loading..." : "View Image"}
                </button>
              </div>

              {/* Extracted Fields Table */}
              <div className="mt-3 rounded-xl bg-[#f8fbfe] border border-[#e2ebf3] p-3 text-xs">
                <h4 className="font-bold text-[#183d63] mb-2 flex items-center justify-between">
                  <span>OMR / OCR Extracted Fields</span>
                  <span className="text-[10px] font-normal text-[#788ca0]">
                    Never activates order automatically
                  </span>
                </h4>
                {Object.keys(scanData.extracted_fields || {}).length === 0 ? (
                  <p className="text-[#788ca0] italic">
                    {status === "processing_failed"
                      ? "Processing failed closed: clinic form template is uncalibrated or coordinates unconfigured."
                      : "No fields extracted yet. Process scan or record human review."}
                  </p>
                ) : (
                  <div className="space-y-1 font-mono text-[11px]">
                    {Object.entries(scanData.extracted_fields).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-[#edf4fa] last:border-0">
                        <span className="text-[#516d89]">{k}:</span>
                        <span className="font-bold text-[#183d63]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Failure Notice if any */}
              {scanData.failure_code && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="size-4" /> Processing Failed Closed
                  </p>
                  <p className="mt-1">
                    Code: <span className="font-mono">{scanData.failure_code}</span>. All uncertain or unconfigured extractions remain human-review tasks.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Doctor Decision & Assistant Verification Forms */}
        <div className="space-y-6">
          {/* Step 2: Doctor Clinical Decision */}
          <div
            className={`rounded-2xl border p-5 shadow-xs transition ${
              isDoctor
                ? "border-[#0c4b80] bg-white ring-1 ring-[#0c4b80]/15"
                : "border-[#d8e0e7] bg-[#fbfcfd]"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
              <div className="flex items-center gap-2">
                <Stethoscope className="size-4 text-[#0c4b80]" />
                <h2 className="text-sm font-bold text-[#183d63]">
                  2. Clinician Decision (Doctor)
                </h2>
              </div>
              {hasDoctorDecision ? (
                <Badge variant="completed" size="sm">
                  Authorized (Rev {scanData?.clinical_decision?.revision})
                </Badge>
              ) : (
                <Badge variant="moderate" size="sm">
                  Action Required
                </Badge>
              )}
            </div>

            {!isDoctor && !hasDoctorDecision && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#fff7e6] p-3 text-xs text-[#975a16] border border-[#fcd38d]">
                <Lock className="size-4 shrink-0" />
                <span>
                  Only authenticated Doctors can authorize the clinical decision. Use the account switcher in the top right to switch to <strong>doctor</strong>.
                </span>
              </div>
            )}

            {hasDoctorDecision && (
              <div className="mt-3 rounded-xl bg-[#edf5fb] p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#667c91]">Follow-up Required:</span>
                  <span className="font-bold text-[#183d63]">
                    {scanData?.clinical_decision?.followup_required ? "YES" : "NO"}
                  </span>
                </div>
                {scanData?.clinical_decision?.followup_required && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#667c91]">Severity:</span>
                      <Badge variant={scanData.clinical_decision.severity || "default"} size="sm">
                        {scanData.clinical_decision.severity}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#667c91]">Scheduled Time:</span>
                      <span className="font-semibold text-[#183d63]">
                        {scanData.clinical_decision.scheduled_at
                          ? new Date(scanData.clinical_decision.scheduled_at).toLocaleString()
                          : "Not scheduled"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#667c91]">Facility Timezone:</span>
                      <span className="font-mono text-[#516d89]">
                        {scanData.clinical_decision.timezone}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Doctor Decision Form */}
            {isDoctor && (status === "needs_review" || status === "clarification_required") && (
              <form onSubmit={handleRecordDecision} className="mt-4 space-y-3.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="dec-req"
                    checked={decRequired}
                    onChange={(e) => setDecRequired(e.target.checked)}
                    className="size-4 rounded text-[#0c4b80] focus:ring-[#0c4b80]"
                  />
                  <label htmlFor="dec-req" className="text-xs font-bold text-[#183d63]">
                    Follow-up Clinically Required
                  </label>
                </div>

                {decRequired && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#45627f] block mb-1">
                          Severity Level
                        </label>
                        <select
                          value={decSeverity}
                          onChange={(e) => setDecSeverity(e.target.value as Severity)}
                          className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                        >
                          <option value="normal">Normal (Routine)</option>
                          <option value="moderate">Moderate (High Risk)</option>
                          <option value="severe">Severe (Critical Follow-Up)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#45627f] block mb-1">
                          Appointment Date &amp; Time
                        </label>
                        <input
                          type="datetime-local"
                          value={decDateTime}
                          onChange={(e) => setDecDateTime(e.target.value)}
                          required={decRequired}
                          className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Facility Timezone
                  </label>
                  <input
                    type="text"
                    value={decTimezone}
                    onChange={(e) => setDecTimezone(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Clinical Reason / Justification
                  </label>
                  <input
                    type="text"
                    value={decReason}
                    onChange={(e) => setDecReason(e.target.value)}
                    required
                    minLength={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingDecision || !scanId}
                    className="rounded-full bg-[#0c4b80] px-5 py-2 text-xs font-bold text-white hover:bg-[#08355c] transition disabled:opacity-50"
                  >
                    {submittingDecision ? "Saving Decision..." : "Authorize Clinical Decision"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Step 3: Assistant Verification Form */}
          <div
            className={`rounded-2xl border p-5 shadow-xs transition ${
              isAssistant
                ? "border-[#25aea8] bg-white ring-1 ring-[#25aea8]/25"
                : "border-[#d8e0e7] bg-[#fbfcfd]"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-[#25aea8]" />
                <h2 className="text-sm font-bold text-[#183d63]">
                  3. Assistant Verification (Identity &amp; Match)
                </h2>
              </div>
              <Badge variant={status === "verified" ? "completed" : "outline"} size="sm">
                {status || "Awaiting Verification"}
              </Badge>
            </div>

            {!hasDoctorDecision && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#fff7e6] p-3 text-xs text-[#975a16] border border-[#fcd38d]">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  Prerequisite: A Doctor must authorize the clinical decision before the Assistant can verify identity and fields.
                </span>
              </div>
            )}

            {!isAssistant && hasDoctorDecision && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f0f9ff] p-3 text-xs text-[#0369a1] border border-[#bae6fd]">
                <UserCheck className="size-4 shrink-0" />
                <span>
                  Verification requires <strong>assistant_verifier</strong>. Switch to the <strong>assistant</strong> account to verify.
                </span>
              </div>
            )}

            {isAssistant && hasDoctorDecision && (
              <form onSubmit={handleVerifyScan} className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Verification Decision
                  </label>
                  <select
                    value={verResult}
                    onChange={(e) => setVerResult(e.target.value as any)}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  >
                    <option value="verified">Verified (Approved &amp; Matched)</option>
                    <option value="clarification_required">Clarification Required</option>
                    <option value="rejected">Rejected (Discard Scan)</option>
                  </select>
                </div>

                {verResult === "verified" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-[#45627f]">
                            Patient Identifier
                          </label>
                          <button
                            type="button"
                            onClick={handleVerifyPatientLookup}
                            className="text-[10px] text-[#0c4b80] hover:underline"
                          >
                            Verify lookup
                          </button>
                        </div>
                        <input
                          type="text"
                          value={verPatientId}
                          onChange={(e) => setVerPatientId(e.target.value)}
                          required
                          className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                        />
                        {patientLookupStatus && (
                          <p className="mt-1 text-[10px] text-[#45627f]">{patientLookupStatus}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-[#45627f]">
                            Encounter Identifier
                          </label>
                          <button
                            type="button"
                            onClick={handleVerifyEncounterLookup}
                            className="text-[10px] text-[#0c4b80] hover:underline"
                          >
                            Verify lookup
                          </button>
                        </div>
                        <input
                          type="text"
                          value={verEncounterId}
                          onChange={(e) => setVerEncounterId(e.target.value)}
                          required
                          className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                        />
                        {encounterLookupStatus && (
                          <p className="mt-1 text-[10px] text-[#45627f]">{encounterLookupStatus}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="ver-req"
                        checked={verRequired}
                        onChange={(e) => setVerRequired(e.target.checked)}
                        className="size-4 rounded text-[#25aea8] focus:ring-[#25aea8]"
                      />
                      <label htmlFor="ver-req" className="text-xs font-bold text-[#183d63]">
                        Confirm Follow-up Required (Must match doctor decision)
                      </label>
                    </div>

                    {verRequired && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-[#45627f] block mb-1">
                            Confirmed Severity
                          </label>
                          <select
                            value={verSeverity}
                            onChange={(e) => setVerSeverity(e.target.value as Severity)}
                            className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                          >
                            <option value="normal">Normal</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[#45627f] block mb-1">
                            Confirmed Appointment Time
                          </label>
                          <input
                            type="datetime-local"
                            value={verDateTime}
                            onChange={(e) => setVerDateTime(e.target.value)}
                            required={verRequired}
                            className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Transcription Corrections (optional, JSON or notes)
                  </label>
                  <input
                    type="text"
                    value={verCorrectionSummary}
                    onChange={(e) => setVerCorrectionSummary(e.target.value)}
                    placeholder="e.g. corrected birth date transcription"
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Verification Review Notes / Reason
                  </label>
                  <input
                    type="text"
                    value={verReason}
                    onChange={(e) => setVerReason(e.target.value)}
                    required={verResult !== "verified"}
                    maxLength={500}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingVerification || !scanId}
                    className="rounded-full bg-[#c94e08] px-6 py-2 text-xs font-bold text-white hover:bg-[#b84600] transition disabled:opacity-50"
                  >
                    {submittingVerification ? "Verifying..." : "Submit Verification Decision"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
              <span className="text-sm font-bold text-[#183d63]">
                Scan Document Image ({scanData?.form_identifier})
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  if (imageUrl) URL.revokeObjectURL(imageUrl);
                  setImageUrl(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <XCircle className="size-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-[#17212b]/5 rounded-xl mt-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Scan document"
                  className="max-w-full max-h-[70vh] rounded shadow-md object-contain"
                />
              ) : (
                <LoadingSpinner message="Loading scan image..." />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
