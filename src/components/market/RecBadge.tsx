import type { Recommendation, VaultStatus } from "@/lib/market-model";

const REC_STYLES: Record<Recommendation, string> = {
  FARM: "bg-primary/15 text-primary border-primary/40",
  "SELL NOW": "bg-success/15 text-success border-success/40",
  HOLD: "bg-accent/15 text-accent border-accent/40",
  SKIP: "bg-muted text-muted-foreground border-border",
};

export function RecBadge({ rec }: { rec: Recommendation }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${REC_STYLES[rec]}`}
    >
      {rec}
    </span>
  );
}

export function VaultBadge({ status }: { status: VaultStatus }) {
  const map: Record<VaultStatus, string> = {
    vaulted: "border-accent/40 text-accent",
    available: "border-success/40 text-success",
    unknown: "border-border text-muted-foreground",
  };
  return (
    <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] ${map[status]}`}>
      {status === "unknown" ? "unknown" : status}
    </span>
  );
}
