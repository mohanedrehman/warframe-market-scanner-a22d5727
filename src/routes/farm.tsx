import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { fetchSnapshots } from "@/lib/wfm.functions";
import { ACTIVITY_LABELS, SCAN_SLUGS, VAULT_CURATED_NOTE, isFarmable, type ActivityType } from "@/lib/market-model";
import { buildRows } from "@/lib/rows";
import { useFarmTimes } from "@/hooks/useLocalStore";
import { OpportunityTable } from "@/components/market/OpportunityTable";
import { ErrorState, Freshness } from "@/components/market/Freshness";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/farm")({
  head: () => ({
    meta: [
      { title: "What should I farm now? — Warframe plat per hour ranking" },
      {
        name: "description",
        content:
          "Rank realistically farmable Warframe items — Prime parts, Corrupted mods, Requiem and Syndicate mods — by live demand and estimated platinum per hour.",
      },
      { property: "og:title", content: "What should I farm now?" },
      {
        property: "og:description",
        content: "Only farmable items, ranked by live buy prices, demand and your own farm-time estimates.",
      },
    ],
  }),
  component: FarmPage,
});

const FILTERS: (ActivityType | "all")[] = ["all", "prime", "corrupted-mod", "syndicate", "kuva-requiem", "arcane", "other"];

function FarmPage() {
  const run = useServerFn(fetchSnapshots);
  const { farmTimes, setFarmTime } = useFarmTimes();
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const query = useQuery({
    queryKey: ["snapshots", "scan"],
    queryFn: () => run({ data: { slugs: SCAN_SLUGS } }),
    staleTime: 4 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const all = buildRows(query.data?.snapshots ?? [], farmTimes).filter((r) => isFarmable(r.snap));
    return filter === "all" ? all : all.filter((r) => r.snap.activity === filter);
  }, [query.data, farmTimes, filter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">What should I farm now?</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Only items you can actually go and get in-game. Cosmetics, captura scenes and other non-farmable listings are
        excluded, and Rivens are handled separately because their value depends on the roll, not the item name.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "secondary"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All activities" : ACTIVITY_LABELS[f]}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        <Freshness
          fetchedAt={query.data?.generatedAt ?? null}
          stale={(query.data?.snapshots ?? []).some((s) => s.stale)}
          loading={query.isFetching}
          onRefresh={() => query.refetch()}
          note={`Scanning ${SCAN_SLUGS.length} items · results cached server-side · ${VAULT_CURATED_NOTE}`}
        />
      </div>

      <div className="mt-5">
        {query.isError ? (
          <ErrorState
            message={query.error instanceof Error ? query.error.message : "Scan failed"}
            onRetry={() => query.refetch()}
          />
        ) : query.isLoading ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Scanning the market at a polite request rate — this first load takes a few seconds…
          </div>
        ) : (
          <OpportunityTable rows={rows} onFarmMinutes={setFarmTime} />
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Farm-time values are editable estimates you own — they are not drop-table facts. The data layer is structured so
        official or wiki drop-table timings can replace them later without changing the scoring.
      </p>
    </div>
  );
}
