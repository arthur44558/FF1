import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ApiError } from "../../api/client";

interface ErrorBannerProps {
  error: Error | ApiError | string | null;
  onRetry?: () => void;
  title?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onRetry,
  title = "An error occurred",
}) => {
  if (!error) return null;

  let message = "";
  let code = "";
  let validationErrors: Array<{ location: string[]; message: string }> = [];

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof ApiError) {
    message = error.message;
    code = error.code;
    if (error.errors) {
      validationErrors = error.errors;
    }
  } else {
    message = error.message || "An unexpected error occurred.";
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-[#fda29b] bg-[#fef3f2] p-4 text-[#7a271a] my-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 shrink-0 text-[#b42318] mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-[#b42318]">{title}</h4>
            {code && (
              <span className="font-mono text-[10px] bg-[#fee4e2] text-[#912018] px-2 py-0.5 rounded">
                {code}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#7a271a]">{message}</p>
          {validationErrors.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 text-[#912018]">
              {validationErrors.map((v, i) => (
                <li key={i}>
                  <span className="font-medium">{v.location.join(".")}</span>: {v.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#fda29b] bg-white px-3 py-1.5 text-xs font-semibold text-[#b42318] hover:bg-[#fee4e2] transition shrink-0"
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  );
};
