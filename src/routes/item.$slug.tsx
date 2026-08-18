import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { fetchItemDetail } from "@/lib/wfm.functions";
import { formatPlat, VAULT_CURATED_NOTE } from "@/lib/market-model";
import { buildRow } from "@/lib/rows";
import { useFarmTimes } from "@/hooks/useLocalStore";
import { ErrorState, Freshness } from "@/components/market/Freshness";
import { RecBadge, VaultBadge } from "@/components/market/RecBadge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/item/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${pretty} — live buy & sell orders | Warframe Market Scanner` },
        {
          name: "description",
          content: `Live Warframe.Market buy orders, sell orders, price history and trading advice for ${pretty}.`,
        },
        { property: "og:title", content: `${pretty} — live Warframe.Market prices` },
        { property: "og:description", content: `Top online buyers and sellers, 90-day price trend and a plain-English read on ${pretty}.` },
      ],
    };
  },
  component: ItemPage,
});

function ItemPage() {
  const { slug } = Route.useParams();
  const run = useServerFn(fetchItemDetail);
  const { farmTimes, setFarmTime } = useFarmTimes();

  const query = useQuery({
    queryKey: ["item", slug],
    queryFn: () => run({ data: { slug } }),
    staleTime: 4 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (query.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Request failed"}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  if (!query.data) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Loading live orders…</div>;
  }

  const { snapshot, orders, history, historyError, volume7d, weighted7d } = query.data;
  const row = buildRow(snapshot, farmTimes);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="panel clip-corner hero-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-primary uppercase">{snapshot.category}</p>
            <h1 className="mt-1 text-3xl font-bold">{snapshot.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {snapshot.isSet
                ? "This is the COMPLETE SET — buying/selling all components together."
                : snapshot.isComponent
                  ? "This is a SINGLE COMPONENT, not the complete set."
                  : "Single tradable item."}
              {snapshot.ducats ? ` · ${snapshot.ducats} ducats` : ""}
              {snapshot.focusRank !== null
                ? ` · prices shown for rank ${snapshot.focusRank} (the rank most buyers are asking for)`
                : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RecBadge rec={row.score.recommendation} />
            <VaultBadge status={row.vault} />
            <a
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              href={`https://warframe.market/items/${snapshot.slug}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              View on Warframe.Market <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        <div className="mt-4">
          <Freshness
            fetchedAt={snapshot.fetchedAt || null}
            stale={snapshot.stale}
            loading={query.isFetching}
            onRefresh={() => query.refetch()}
            note={VAULT_CURATED_NOTE}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Highest buy (you receive)" value={formatPlat(snapshot.highestBuy)} tone="text-success" />
        <Metric label="Lowest sell (asking)" value={formatPlat(snapshot.lowestSell)} tone="text-accent" />
        <Metric label="7-day weighted avg" value={weighted7d === null ? "—" : formatPlat(weighted7d, 1)} />
        <Metric label="7-day volume" value={String(volume7d)} />
      </div>

      <div className="panel clip-corner mt-6 p-5">
        <h2 className="text-lg font-semibold">Interpretation</h2>
        <p className="mt-2 text-sm text-muted-foreground">{row.score.reason}</p>
        {snapshot.rankNote ? <p className="mt-1 text-xs text-warning">{snapshot.rankNote}</p> : null}
        <div className="mt-4 flex flex-wrap items-end gap-4 text-sm">
          <label className="text-xs text-muted-foreground">
            Your farm-time estimate (minutes)
            <Input
              type="number"
              min={1}
              className="tabular mt-1 h-9 w-28"
              value={row.farmMinutes}
              onChange={(e) => setFarmTime(slug, Number(e.target.value))}
            />
          </label>
          <p className="tabular">
            plat/hour ≈ <span className="font-semibold">{formatPlat(Math.round(row.score.platPerHour))}</span> · score{" "}
            {row.score.total.toFixed(0)}/100
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Farm time is a user estimate, not drop-table data. plat/hour = highest active buy price × (60 ÷ minutes).
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OrderList title="Top BUY orders — players paying you" orders={orders.buy} tone="text-success" />
        <OrderList title="Top SELL orders — what sellers ask" orders={orders.sell} tone="text-accent" />
      </div>

      <div className="panel clip-corner mt-6 p-5">
        <h2 className="text-lg font-semibold">90-day price trend</h2>
        {historyError ? (
          <p className="mt-2 text-sm text-muted-foreground">Price history unavailable: {historyError}.</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No historical statistics returned for this item.</p>
        ) : (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={40} />
                <RTooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="median" stroke="var(--color-chart-1)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="avg" stroke="var(--color-chart-2)" dot={false} strokeWidth={1} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel clip-corner p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

type OrderRow = {
  id: string;
  platinum: number;
  quantity: number;
  rank?: number | undefined;
  user: { ingameName: string; status: string; reputation: number };
};

function OrderList({ title, orders, tone }: { title: string; orders: OrderRow[]; tone: string }) {
  return (
    <div className="panel clip-corner p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="mt-3 space-y-1 text-sm">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-secondary/50">
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  o.user.status === "ingame" ? "bg-success" : o.user.status === "online" ? "bg-primary" : "bg-muted-foreground/50"
                }`}
              />
              <span>{o.user.ingameName}</span>
              <span className="text-xs text-muted-foreground">
                {o.user.status}
                {typeof o.rank === "number" ? ` · rank ${o.rank}` : ""}
              </span>
            </span>
            <span className={`tabular font-semibold ${tone}`}>
              {formatPlat(o.platinum)} <span className="text-xs text-muted-foreground">×{o.quantity}</span>
            </span>
          </li>
        ))}
        {orders.length === 0 ? <li className="text-sm text-muted-foreground">No active orders returned.</li> : null}
      </ul>
    </div>
  );
}
