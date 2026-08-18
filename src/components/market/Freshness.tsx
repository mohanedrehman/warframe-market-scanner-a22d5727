import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatWhen } from "@/lib/market-model";
import { Button } from "@/components/ui/button";

export function Freshness({
  fetchedAt,
  stale,
  loading,
  onRefresh,
  note,
}: {
  fetchedAt: number | null;
  stale?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="tabular">
        Last updated: {loading ? "refreshing…" : formatWhen(fetchedAt)} {fetchedAt ? "(UK time)" : ""}
      </span>
      {stale ? (
        <span className="inline-flex items-center gap-1 text-warning">
          <AlertTriangle className="size-3.5" /> Showing last known good data — the API did not respond.
        </span>
      ) : null}
      {note ? <span>{note}</span> : null}
      {onRefresh ? (
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} className="h-7 px-2">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel clip-corner p-6 text-sm">
      <p className="font-semibold text-destructive">Live prices unavailable</p>
      <p className="mt-2 text-muted-foreground">
        {message}. No prices are shown because nothing was returned — this app never invents figures.
      </p>
      {onRetry ? (
        <Button className="mt-4" size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
