import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="absolute right-4 top-4 text-[#8b9996] hover:text-[#183d63] transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              destructive ? "bg-red-50 text-red-600" : "bg-blue-50 text-[#0c4b80]"
            }`}
          >
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-[#183d63]">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#667c91]">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-full border border-[#d8e0e7] bg-white px-4 py-2 text-xs font-semibold text-[#45627f] hover:bg-[#f7faff] transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-full px-5 py-2 text-xs font-semibold text-white transition ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#c94e08] hover:bg-[#b84600]"
            } disabled:opacity-60`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
