import { Link } from "@tanstack/react-router";
import { ExternalLink, Info } from "lucide-react";
import { formatPlat } from "@/lib/market-model";
import type { OpportunityRow } from "@/lib/rows";
import { RecBadge, VaultBadge } from "./RecBadge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function OpportunityTable({
  rows,
  onFarmMinutes,
}: {
  rows: OpportunityRow[];
  onFarmMinutes: (slug: string, minutes: number) => void;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wider text-muted-foreground uppercase">
            <th className="p-3">Item</th>
            <th className="p-3">Category</th>
            <th className="p-3" title="Highest active BUY order — what someone will pay you now">
              Top buy (you get)
            </th>
            <th className="p-3" title="Lowest active SELL order — what sellers are asking">
              Low sell (asking)
            </th>
            <th className="p-3">Spread</th>
            <th className="p-3">Buyers</th>
            <th className="p-3">Sellers</th>
            <th className="p-3">24h activity</th>
            <th className="p-3">Farm mins</th>
            <th className="p-3">Plat/hour</th>
            <th className="p-3">Vault</th>
            <th className="p-3">Score</th>
            <th className="p-3">Call</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.snap.slug} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
              <td className="p-3">
                <Link
                  to="/item/$slug"
                  params={{ slug: r.snap.slug }}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {r.snap.name}
                </Link>
                <div className="text-[11px] text-muted-foreground">
                  {r.snap.isSet ? "Complete set" : r.snap.isComponent ? "Single component" : "Single item"}
                  {r.snap.focusRank !== null ? ` · rank ${r.snap.focusRank}` : ""}
                  {r.snap.error ? <span className="text-destructive"> · {r.snap.error}</span> : null}
                </div>
              </td>
              <td className="p-3 text-muted-foreground">{r.snap.category}</td>
              <td className="tabular p-3 text-success">{formatPlat(r.snap.highestBuy)}</td>
              <td className="tabular p-3 text-accent">{formatPlat(r.snap.lowestSell)}</td>
              <td className="tabular p-3">
                {r.snap.spread === null ? "—" : `${formatPlat(r.snap.spread)} (${r.spreadPct.toFixed(0)}%)`}
              </td>
              <td className="tabular p-3">
                {r.snap.onlineBuyers}
                <span className="text-muted-foreground">/{r.snap.buyers}</span>
              </td>
              <td className="tabular p-3">
                {r.snap.onlineSellers}
                <span className="text-muted-foreground">/{r.snap.sellers}</span>
              </td>
              <td className="tabular p-3">{r.snap.activity24h}</td>
              <td className="p-3">
                <Input
                  type="number"
                  min={1}
                  value={r.farmMinutes}
                  onChange={(e) => onFarmMinutes(r.snap.slug, Number(e.target.value))}
                  className="tabular h-8 w-20"
                  aria-label={`Farm time estimate in minutes for ${r.snap.name}`}
                />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {r.farmMinutesIsUserSet ? "your estimate" : "default estimate"}
                </div>
              </td>
              <td className="tabular p-3 font-semibold">{formatPlat(Math.round(r.score.platPerHour))}</td>
              <td className="p-3">
                <VaultBadge status={r.vault} />
              </td>
              <td className="p-3">
                <Tooltip>
                  <TooltipTrigger className="tabular inline-flex items-center gap-1 font-semibold">
                    {r.score.total.toFixed(0)}
                    <Info className="size-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p>value {r.score.valueScore.toFixed(1)}/45 · demand {r.score.demandScore.toFixed(1)}/25</p>
                    <p>liquidity {r.score.liquidityScore.toFixed(1)}/20 · spread {r.score.spreadScore.toFixed(1)}/10</p>
                    <p className="mt-1 text-muted-foreground">{r.score.reason}</p>
                  </TooltipContent>
                </Tooltip>
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <RecBadge rec={r.score.recommendation} />
                  <a
                    href={`https://warframe.market/items/${r.snap.slug}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-primary"
                    aria-label={`Open ${r.snap.name} on Warframe.Market`}
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={13} className="p-6 text-center text-muted-foreground">
                Nothing to show yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
