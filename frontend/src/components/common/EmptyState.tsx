import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-[#d8e0e7] bg-[#f9fbfe]/60 my-4">
      <div className="grid size-12 place-items-center rounded-2xl bg-[#edf4fa] text-[#0c4b80] mb-3">
        {icon || <FolderOpen className="size-6 text-[#0c4b80]" />}
      </div>
      <h3 className="text-sm font-bold text-[#183d63]">{title}</h3>
      {description && <p className="text-xs text-[#667c91] max-w-sm mt-1">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0c4b80] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
