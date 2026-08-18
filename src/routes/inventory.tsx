import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { fetchSnapshots, searchMarketItems } from "@/lib/wfm.functions";
import { formatPlat, vaultStatus, VAULT_CURATED_NOTE } from "@/lib/market-model";
import { buildRow } from "@/lib/rows";
import { useFarmTimes, useInventory } from "@/hooks/useLocalStore";
import { ErrorState, Freshness } from "@/components/market/Freshness";
import { RecBadge, VaultBadge } from "@/components/market/RecBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "My inventory — what to sell, complete or hold | Warframe Market Scanner" },
      {
        name: "description",
        content:
          "Enter the Prime parts, sets and mods you own and see live buy prices, what to sell now, what to hold and total instant plat value.",
      },
      { property: "og:title", content: "My Warframe inventory valuation" },
      { property: "og:description", content: "Live valuation of your Prime parts and mods with sell / hold calls." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { inventory, upsert, remove, loaded } = useInventory();
  const { farmTimes } = useFarmTimes();
  const doSearch = useServerFn(searchMarketItems);
  const doSnap = useServerFn(fetchSnapshots);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const search = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => doSearch({ data: { query: submitted } }),
    enabled: submitted.length >= 2,
    staleTime: 60 * 60 * 1000,
  });

  const slugs = inventory.map((i) => i.slug);
  const prices = useQuery({
    queryKey: ["snapshots", "inventory", slugs.join(",")],
    queryFn: () => doSnap({ data: { slugs } }),
    enabled: loaded && slugs.length > 0,
    staleTime: 4 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const byslug = new Map((prices.data?.snapshots ?? []).map((s) => [s.slug, s]));
    return inventory
      .map((entry) => {
        const snap = byslug.get(entry.slug);
        return snap ? { entry, row: buildRow(snap, farmTimes) } : null;
      })
      .filter((x): x is { entry: (typeof inventory)[number]; row: ReturnType<typeof buildRow> } => x !== null)
      .sort((a, b) => (b.row.snap.highestBuy ?? 0) * b.entry.quantity - (a.row.snap.highestBuy ?? 0) * a.entry.quantity);
  }, [inventory, prices.data, farmTimes]);

  const totalInstant = rows.reduce((a, r) => a + (r.row.snap.highestBuy ?? 0) * r.entry.quantity, 0);
  const totalPatient = rows.reduce((a, r) => a + (r.row.snap.lowestSell ?? 0) * r.entry.quantity, 0);

  const holds = rows.filter((r) => vaultStatus(r.row.snap.slug) === "vaulted" || r.row.score.recommendation === "HOLD");
  const sells = rows.filter((r) => r.row.score.recommendation === "SELL NOW");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">My inventory</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manually enter what you own. Stored in this browser only — nothing is uploaded, no account required.
      </p>

      <section className="panel clip-corner mt-6 p-5">
        <h2 className="text-base font-semibold">Add an item</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(term);
          }}
        >
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a Prime part, set or mod"
            className="h-10"
            aria-label="Search item to add"
          />
          <Button type="submit" className="h-10">
            Search
          </Button>
        </form>
        {search.data ? (
          <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {search.data.results.map((r) => (
              <li key={r.slug} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {r.name} <span className="ml-1 text-xs text-muted-foreground">{r.category}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => upsert({ slug: r.slug, name: r.name, quantity: 1 })}
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Cell label="Instant sell value (top buy orders)" value={formatPlat(totalInstant)} tone="text-success" />
        <Cell label="Patient sale value (asking prices)" value={formatPlat(totalPatient)} tone="text-accent" />
        <Cell label="Distinct items" value={String(inventory.length)} />
      </section>

      <div className="mt-4">
        <Freshness
          fetchedAt={prices.data?.generatedAt ?? null}
          stale={(prices.data?.snapshots ?? []).some((s) => s.stale)}
          loading={prices.isFetching}
          onRefresh={() => prices.refetch()}
          note={VAULT_CURATED_NOTE}
        />
      </div>

      {prices.isError ? (
        <div className="mt-4">
          <ErrorState
            message={prices.error instanceof Error ? prices.error.message : "Valuation failed"}
            onRetry={() => prices.refetch()}
          />
        </div>
      ) : null}

      <section className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th className="p-3">Item</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Top buy</th>
              <th className="p-3">Low sell</th>
              <th className="p-3">Instant total</th>
              <th className="p-3">Vault</th>
              <th className="p-3">Call</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, row }) => (
              <tr key={entry.slug} className="border-b border-border/60 last:border-0">
                <td className="p-3">
                  <Link to="/item/$slug" params={{ slug: entry.slug }} className="hover:text-primary">
                    {row.snap.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    {row.snap.isSet ? "complete set" : "component / single item"}
                  </div>
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    min={0}
                    value={entry.quantity}
                    onChange={(e) => upsert({ ...entry, quantity: Math.max(0, Number(e.target.value)) })}
                    className="tabular h-8 w-20"
                    aria-label={`Quantity of ${entry.name}`}
                  />
                </td>
                <td className="tabular p-3 text-success">{formatPlat(row.snap.highestBuy)}</td>
                <td className="tabular p-3 text-accent">{formatPlat(row.snap.lowestSell)}</td>
                <td className="tabular p-3 font-semibold">
                  {formatPlat((row.snap.highestBuy ?? 0) * entry.quantity)}
                </td>
                <td className="p-3">
                  <VaultBadge status={row.vault} />
                </td>
                <td className="p-3">
                  <RecBadge rec={row.score.recommendation} />
                </td>
                <td className="p-3">
                  <Button size="icon" variant="ghost" onClick={() => remove(entry.slug)} aria-label="Remove">
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {inventory.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Nothing added yet — search above to start.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Advice
          title="Sell now"
          empty="Nothing in your list has multiple online buyers at a good price right now."
          items={sells.map((r) => `${r.row.snap.name} — ${formatPlat(r.row.snap.highestBuy)} from a live buyer`)}
        />
        <Advice
          title="Hold"
          empty="Nothing flagged to hold."
          items={holds.map(
            (r) =>
              `${r.row.snap.name} — ${
                vaultStatus(r.row.snap.slug) === "vaulted" ? "vaulted (curated list), supply shrinks over time" : r.row.score.reason
              }`,
          )}
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Set completion: add the individual components you own and the matching “… Prime Set” entry. The scanner shows
        both, so you can compare buying the missing parts at the asking price against the set’s current buy price.
      </p>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel clip-corner p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Advice({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="panel clip-corner p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
