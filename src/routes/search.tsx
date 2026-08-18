import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { fetchSnapshots, searchMarketItems } from "@/lib/wfm.functions";
import { formatPlat } from "@/lib/market-model";
import { buildRow } from "@/lib/rows";
import { useFarmTimes } from "@/hooks/useLocalStore";
import { ErrorState, Freshness } from "@/components/market/Freshness";
import { RecBadge } from "@/components/market/RecBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search any Warframe.Market item — live orders & price read" },
      {
        name: "description",
        content:
          "Search Prime sets, Prime parts, mods and weapons on Warframe.Market and see live buy orders, sell orders and a plain-English interpretation.",
      },
      { property: "og:title", content: "Search any Warframe.Market item" },
      { property: "og:description", content: "Live buy/sell orders and a plain-English read for any tradable item." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const doSearch = useServerFn(searchMarketItems);
  const doSnap = useServerFn(fetchSnapshots);
  const { farmTimes } = useFarmTimes();

  const results = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => doSearch({ data: { query: submitted } }),
    enabled: submitted.length >= 2,
    staleTime: 60 * 60 * 1000,
  });

  const detail = useQuery({
    queryKey: ["snapshots", selected],
    queryFn: () => doSnap({ data: { slugs: [selected!] } }),
    enabled: !!selected,
    staleTime: 4 * 60 * 1000,
  });

  const row = useMemo(() => {
    const snap = detail.data?.snapshots?.[0];
    return snap ? buildRow(snap, farmTimes) : null;
  }, [detail.data, farmTimes]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Search the market</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Prime sets and parts, mods, arcanes, weapons — anything Warframe.Market lists. Riven auctions live on the Riven
        page because they use a different data source.
      </p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term);
          setSelected(null);
        }}
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. Zephyr Prime Set, Blind Rage, Torid"
          className="h-11"
          aria-label="Item name"
        />
        <Button type="submit" className="h-11">
          <SearchIcon className="size-4" /> Search
        </Button>
      </form>

      {results.isError ? (
        <div className="mt-6">
          <ErrorState
            message={results.error instanceof Error ? results.error.message : "Search failed"}
            onRetry={() => results.refetch()}
          />
        </div>
      ) : null}

      {results.data ? (
        <div className="panel clip-corner mt-6 divide-y divide-border">
          {results.data.results.map((r) => (
            <button
              key={r.slug}
              onClick={() => setSelected(r.slug)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-secondary/50"
            >
              <span>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{r.category}</span>
              </span>
              <span className="text-xs text-primary">View live orders</span>
            </button>
          ))}
          {results.data.results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No items matched that search.</p>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <section className="panel clip-corner mt-6 p-5">
          {detail.isLoading || !row ? (
            <p className="text-sm text-muted-foreground">Loading live orders…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{row.snap.name}</h2>
                <RecBadge rec={row.score.recommendation} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Cell label="Highest buy (you receive)" value={formatPlat(row.snap.highestBuy)} tone="text-success" />
                <Cell label="Lowest sell (asking)" value={formatPlat(row.snap.lowestSell)} tone="text-accent" />
                <Cell
                  label="Buyers online / total"
                  value={`${row.snap.onlineBuyers} / ${row.snap.buyers}`}
                />
                <Cell label="Orders updated 24h" value={String(row.snap.activity24h)} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{row.score.reason}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  to="/item/$slug"
                  params={{ slug: row.snap.slug }}
                  className="text-sm text-primary hover:underline"
                >
                  Full item detail, order book and trend →
                </Link>
                <Freshness fetchedAt={row.snap.fetchedAt || null} stale={row.snap.stale} />
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular mt-1 text-lg font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
