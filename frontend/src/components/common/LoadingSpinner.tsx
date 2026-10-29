import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
  size = "md",
}) => {
  const iconSize = size === "sm" ? "size-4" : size === "lg" ? "size-8" : "size-6";
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-[#667c91]">
      <Loader2 className={`animate-spin text-[#0c4b80] ${iconSize}`} />
      {message && <p className="mt-3 text-xs font-medium">{message}</p>}
    </div>
  );
};
