import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-md flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          let bg = "bg-white border-[#d8e0e7] text-[#17212b]";
          let icon = <Info className="size-5 text-[#155eef] shrink-0" />;

          if (toast.type === "success") {
            bg = "bg-[#f2fcf7] border-[#81d8b1] text-[#0d543a]";
            icon = <CheckCircle2 className="size-5 text-[#157347] shrink-0" />;
          } else if (toast.type === "error") {
            bg = "bg-[#fef3f2] border-[#fda29b] text-[#7a271a]";
            icon = <XCircle className="size-5 text-[#b42318] shrink-0" />;
          } else if (toast.type === "warning") {
            bg = "bg-[#fffbeb] border-[#fde047] text-[#78350f]";
            icon = <AlertCircle className="size-5 text-[#b45309] shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur transition-all ${bg}`}
              role="alert"
            >
              {icon}
              <div className="flex-1 min-w-0">
                {toast.title && <h4 className="text-sm font-bold">{toast.title}</h4>}
                <p className="text-xs leading-relaxed mt-0.5">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Close notification"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
