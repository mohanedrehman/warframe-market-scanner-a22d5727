import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Coins, Flame, Gauge, Users } from "lucide-react";
import { fetchSnapshots } from "@/lib/wfm.functions";
import { WATCHLIST_SLUGS, formatPlat, VAULT_CURATED_NOTE } from "@/lib/market-model";
import { buildRows } from "@/lib/rows";
import { useFarmTimes } from "@/hooks/useLocalStore";
import { OpportunityTable } from "@/components/market/OpportunityTable";
import { ErrorState, Freshness } from "@/components/market/Freshness";
import { RecBadge } from "@/components/market/RecBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Warframe Market Scanner — Live Plat/Hour Dashboard" },
      {
        name: "description",
        content:
          "Live Warframe.Market buy and sell data ranked by platinum per hour, demand and liquidity. Find what to farm, sell or hold right now.",
      },
      { property: "og:title", content: "Warframe Market Scanner — Live Plat/Hour Dashboard" },
      {
        property: "og:description",
        content: "Rank real Warframe.Market opportunities by plat per hour, live demand and spread.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const run = useServerFn(fetchSnapshots);
  const { farmTimes, setFarmTime } = useFarmTimes();

  const query = useQuery({
    queryKey: ["snapshots", "watchlist"],
    queryFn: () => run({ data: { slugs: WATCHLIST_SLUGS } }),
    staleTime: 4 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(
    () => buildRows(query.data?.snapshots ?? [], farmTimes),
    [query.data, farmTimes],
  );

  const quickSell = useMemo(
    () =>
      rows
        .filter((r) => (r.snap.highestBuy ?? 0) >= 8 && r.snap.onlineBuyers >= 1)
        .sort((a, b) => (b.snap.highestBuy ?? 0) - (a.snap.highestBuy ?? 0))
        .slice(0, 5),
    [rows],
  );

  const totals = useMemo(() => {
    const withBuy = rows.filter((r) => r.snap.highestBuy);
    return {
      tracked: rows.length,
      buyers: rows.reduce((a, r) => a + r.snap.onlineBuyers, 0),
      bestPph: rows.length ? Math.max(...rows.map((r) => r.score.platPerHour)) : 0,
      instantPot: withBuy.reduce((a, r) => a + (r.snap.highestBuy ?? 0), 0),
    };
  }, [rows]);

  const fetchedAt = query.data?.generatedAt ?? null;
  const stale = (query.data?.snapshots ?? []).some((s) => s.stale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="hero-surface panel clip-corner mb-6 p-6 sm:p-8">
        <p className="text-xs tracking-[0.3em] text-primary uppercase">Live market intelligence</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">What can I farm and sell for the most plat right now?</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Ranked from live Warframe.Market orders (PC, crossplay). Buy orders are what a player will pay you now; sell
          orders are what other sellers are asking. Farm times are your own editable estimates, never presented as
          facts.
        </p>
        <div className="mt-5">
          <Freshness
            fetchedAt={fetchedAt}
            stale={stale}
            loading={query.isFetching}
            onRefresh={() => query.refetch()}
            note={`Cached server-side for ~5 min · ≤2.5 requests/sec`}
          />
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Gauge className="size-4" />} label="Items tracked" value={String(totals.tracked)} />
        <Stat icon={<Users className="size-4" />} label="Online buyers (watchlist)" value={String(totals.buyers)} />
        <Stat icon={<Flame className="size-4" />} label="Best plat/hour" value={formatPlat(Math.round(totals.bestPph))} />
        <Stat
          icon={<Coins className="size-4" />}
          label="Instant sell pot (1 each)"
          value={formatPlat(totals.instantPot)}
        />
      </section>

      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "The market API could not be reached"}
          onRetry={() => query.refetch()}
        />
      ) : null}

      <section className="panel clip-corner mb-6 p-5">
        <h2 className="text-lg font-semibold">Quick sell targets — road to 100p</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sorted by what a live buyer will pay you immediately, so a near-empty plat balance can be topped up fast.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickSell.map((r) => (
            <Link
              key={r.snap.slug}
              to="/item/$slug"
              params={{ slug: r.snap.slug }}
              className="rounded-md border border-border bg-secondary/40 p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{r.snap.name}</span>
                <RecBadge rec={r.score.recommendation} />
              </div>
              <p className="tabular mt-2 text-2xl font-semibold text-success">{formatPlat(r.snap.highestBuy)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.snap.onlineBuyers} online buyer(s) · asking price {formatPlat(r.snap.lowestSell)}
              </p>
            </Link>
          ))}
          {quickSell.length === 0 && !query.isLoading ? (
            <p className="text-sm text-muted-foreground">No live buy orders from online players at the moment.</p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">Watchlist opportunities</h2>
          <p className="text-xs text-muted-foreground">Vault status: {VAULT_CURATED_NOTE}</p>
        </div>
        {query.isLoading ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">Loading live orders…</div>
        ) : (
          <OpportunityTable rows={rows} onFarmMinutes={setFarmTime} />
        )}
      </section>

      <section className="panel clip-corner mt-6 p-5 text-sm">
        <h2 className="text-lg font-semibold">How the opportunity score works</h2>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          <li>
            <span className="text-foreground">plat/hour</span> = highest active buy price × (60 ÷ your farm-time
            estimate)
          </li>
          <li>
            <span className="text-foreground">value</span> = log-normalised plat/hour up to 400p/h → 45 points
          </li>
          <li>
            <span className="text-foreground">demand</span> = log-normalised online buyers up to 15 → 25 points
          </li>
          <li>
            <span className="text-foreground">liquidity</span> = orders updated in the last 24h, up to 40 → 20 points
          </li>
          <li>
            <span className="text-foreground">spread</span> = (sell − buy) ÷ sell, capped at 60% → 10 points
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel clip-corner p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
