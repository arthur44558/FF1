import { RefreshCw, WifiOff } from "lucide-react";

interface LiveStatusPillProps {
  lastUpdatedText: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  error?: string | null;
}

export function LiveStatusPill({
  lastUpdatedText,
  isRefreshing,
  onRefresh,
  error,
}: LiveStatusPillProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
          error
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
        title={error || "Live backend synchronization active"}
      >
        {error ? (
          <WifiOff className="size-3 text-rose-500" />
        ) : (
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
          </span>
        )}
        <span>{error ? "Sync Error" : `Synced ${lastUpdatedText}`}</span>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Refresh live data now"
        className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition"
      >
        <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
