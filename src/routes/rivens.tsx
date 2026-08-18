import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { fetchRivenBoard, fetchRivenWeapons } from "@/lib/wfm.functions";
import { formatPlat } from "@/lib/market-model";
import { ErrorState, Freshness } from "@/components/market/Freshness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/rivens")({
  head: () => ({
    meta: [
      { title: "Riven lottery — weapon demand & live auction prices" },
      {
        name: "description",
        content:
          "Rank unveiled Riven weapons by live auction demand and disposition. Auction data is kept separate from normal Warframe.Market item orders.",
      },
      { property: "og:title", content: "Riven lottery — weapon demand ranking" },
      {
        property: "og:description",
        content: "Live Riven auction listings and prices by weapon, with an honest explanation of what they do not tell you.",
      },
    ],
  }),
  component: RivensPage,
});

const DEFAULT_WEAPONS = ["torid", "dual_toxocyst", "kuva_bramma", "phantasma", "acceltra", "kuva_zarr"];

function RivensPage() {
  const doBoard = useServerFn(fetchRivenBoard);
  const doList = useServerFn(fetchRivenWeapons);
  const [weapons, setWeapons] = useState<string[]>(DEFAULT_WEAPONS);
  const [term, setTerm] = useState("");

  const list = useQuery({
    queryKey: ["riven-weapons"],
    queryFn: () => doList(),
    staleTime: 12 * 60 * 60 * 1000,
  });

  const board = useQuery({
    queryKey: ["riven-board", weapons.join(",")],
    queryFn: () => doBoard({ data: { weapons } }),
    staleTime: 9 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const suggestions = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    return (list.data?.weapons ?? []).filter((w) => w.name.toLowerCase().includes(q)).slice(0, 8);
  }, [term, list.data]);

  const rows = useMemo(
    () =>
      [...(board.data?.rows ?? [])].sort((a, b) => {
        const av = (a.medianBuyout ?? 0) * Math.log1p(a.listings);
        const bv = (b.medianBuyout ?? 0) * Math.log1p(b.listings);
        return bv - av;
      }),
    [board.data],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Riven lottery</h1>
      <div className="panel clip-corner mt-4 p-5 text-sm text-muted-foreground">
        <p className="text-foreground">Read this before you trust any Riven number.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Riven prices come from the <span className="text-foreground">auction</span> system, a completely separate
            data source from the normal item buy/sell orders used everywhere else in this app. They are never mixed.
          </li>
          <li>
            A specific roll’s value depends on its stats, rolls used, mastery requirement and polarity. This page does
            not and cannot value your individual roll — it measures <span className="text-foreground">weapon demand</span>.
          </li>
          <li>
            Lower disposition generally means weaker Riven stats; high listing counts mean an easy sale but usually a
            lower price.
          </li>
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Add a weapon
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Torid"
            className="mt-1 h-10 w-64"
          />
        </label>
        {weapons.length > 0 ? (
          <Button variant="secondary" className="h-10" onClick={() => setWeapons(DEFAULT_WEAPONS)}>
            Reset list
          </Button>
        ) : null}
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Button
              key={s.slug}
              size="sm"
              variant="secondary"
              onClick={() => {
                setWeapons((prev) => (prev.includes(s.slug) ? prev : [...prev, s.slug].slice(0, 12)));
                setTerm("");
              }}
            >
              + {s.name}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <Freshness
          fetchedAt={rows[0]?.fetchedAt ?? null}
          stale={rows.some((r) => r.stale)}
          loading={board.isFetching}
          onRefresh={() => board.refetch()}
          note="Auction data cached ~10 min"
        />
      </div>

      {board.isError ? (
        <div className="mt-4">
          <ErrorState
            message={board.error instanceof Error ? board.error.message : "Auction search failed"}
            onRetry={() => board.refetch()}
          />
        </div>
      ) : null}

      <section className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th className="p-3">Weapon</th>
              <th className="p-3">Type</th>
              <th className="p-3">Disposition</th>
              <th className="p-3">Live listings</th>
              <th className="p-3">Sellers online</th>
              <th className="p-3">Cheapest buyout</th>
              <th className="p-3">Median buyout</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-border/60 last:border-0">
                <td className="p-3 font-medium">
                  {r.name}
                  {r.error ? <div className="text-[11px] text-destructive">{r.error}</div> : null}
                </td>
                <td className="p-3 text-muted-foreground">{r.rivenType}</td>
                <td className="tabular p-3">{r.disposition.toFixed(2)}</td>
                <td className="tabular p-3">{r.listings}</td>
                <td className="tabular p-3">{r.onlineSellers}</td>
                <td className="tabular p-3 text-accent">{formatPlat(r.cheapestBuyout)}</td>
                <td className="tabular p-3 font-semibold">{formatPlat(r.medianBuyout)}</td>
                <td className="p-3">
                  <a
                    href={`https://warframe.market/auctions/search?type=riven&weapon_url_name=${r.slug}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-primary"
                    aria-label={`Open ${r.name} riven auctions`}
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </td>
              </tr>
            ))}
            {board.isLoading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Loading auctions at a polite request rate…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
