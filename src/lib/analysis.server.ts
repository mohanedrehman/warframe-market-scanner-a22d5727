import {
  getAllItems,
  getItem,
  getOrders,
  getStatistics,
  getRivenWeapons,
  getRivenAuctions,
  type WfmOrder,
} from "./wfm.server";
import { classify, type ItemSnapshot } from "./market-model";

const ONLINE = new Set(["ingame", "online"]);

function summarise(orders: WfmOrder[]) {
  const visible = orders.filter((o) => o.visible !== false);
  const allBuys = visible.filter((o) => o.type === "buy");
  const allSells = visible.filter((o) => o.type === "sell");

  // Ranked items (mods, arcanes) trade as different goods per rank. Focus on the
  // rank buyers are actually asking for, and compare like with like.
  const ranked = visible.some((o) => typeof o.rank === "number");
  let focusRank: number | null = null;
  if (ranked && allBuys.length) {
    const counts = new Map<number, number>();
    for (const o of allBuys) counts.set(o.rank ?? 0, (counts.get(o.rank ?? 0) ?? 0) + 1);
    focusRank = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
  }

  const atRank = (o: WfmOrder) => focusRank === null || (o.rank ?? 0) === focusRank;
  const buys = allBuys.filter(atRank);
  let sells = allSells.filter(atRank);
  let rankNote: string | undefined;
  if (focusRank !== null && sells.length === 0) {
    sells = allSells;
    rankNote = `No rank ${focusRank} sellers listed; asking price shown is for other ranks.`;
  }

  const onlineBuys = buys.filter((o) => ONLINE.has(o.user?.status));
  const onlineSells = sells.filter((o) => ONLINE.has(o.user?.status));

  const highestBuy = onlineBuys.length
    ? Math.max(...onlineBuys.map((o) => o.platinum))
    : buys.length
      ? Math.max(...buys.map((o) => o.platinum))
      : null;
  const lowestSell = onlineSells.length
    ? Math.min(...onlineSells.map((o) => o.platinum))
    : sells.length
      ? Math.min(...sells.map((o) => o.platinum))
      : null;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const activity24h = visible.filter((o) => new Date(o.updatedAt).getTime() >= dayAgo).length;

  return {
    highestBuy,
    lowestSell,
    spread: highestBuy !== null && lowestSell !== null ? lowestSell - highestBuy : null,
    buyers: buys.length,
    sellers: sells.length,
    onlineBuyers: onlineBuys.length,
    onlineSellers: onlineSells.length,
    activity24h,
    focusRank,
    rankNote,
  };
}

export function topOrders(orders: WfmOrder[]) {
  const visible = orders.filter((o) => o.visible !== false);
  const rank = (o: WfmOrder) => (ONLINE.has(o.user?.status) ? 0 : 1);
  const buy = visible
    .filter((o) => o.type === "buy")
    .sort((a, b) => rank(a) - rank(b) || b.platinum - a.platinum)
    .slice(0, 10);
  const sell = visible
    .filter((o) => o.type === "sell")
    .sort((a, b) => rank(a) - rank(b) || a.platinum - b.platinum)
    .slice(0, 10);
  return { buy, sell };
}

/** Item metadata comes from the single cached /v2/items list to halve request count. */
async function metaFor(slug: string) {
  const { items } = await getAllItems();
  const short = items.find((i) => i.slug === slug);
  if (short) return { tags: short.tags ?? [], i18n: short.i18n?.["en"], ducats: undefined as number | undefined };
  const { item } = await getItem(slug);
  return { tags: item.tags ?? [], i18n: item.i18n?.["en"], ducats: item.ducats };
}

export async function snapshotFor(slug: string): Promise<ItemSnapshot> {
  try {
    const [meta, { orders, fetchedAt, stale }] = await Promise.all([metaFor(slug), getOrders(slug)]);
    const tags = meta.tags;
    const { category, activity } = classify(tags, slug);
    const i18n = meta.i18n;
    return {
      slug,
      name: i18n?.name ?? slug,
      thumb: i18n?.thumb,
      tags,
      category,
      activity,
      isSet: tags.includes("set"),
      isComponent: !tags.includes("set") && (tags.includes("component") || tags.includes("blueprint")),
      ducats: meta.ducats,
      ...summarise(orders),
      fetchedAt,
      stale,
    };
  } catch (err) {
    return {
      slug,
      name: slug.replace(/_/g, " "),
      tags: [],
      category: "Unknown",
      activity: "other",
      isSet: slug.endsWith("_set"),
      isComponent: false,
      highestBuy: null,
      lowestSell: null,
      spread: null,
      buyers: 0,
      sellers: 0,
      onlineBuyers: 0,
      onlineSellers: 0,
      activity24h: 0,
      focusRank: null,
      fetchedAt: 0,
      stale: false,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Sequential-ish batching: the shared limiter already spaces calls out. */
export async function snapshotMany(slugs: string[]): Promise<ItemSnapshot[]> {
  const out: ItemSnapshot[] = [];
  const unique = Array.from(new Set(slugs));
  const size = 6;
  for (let i = 0; i < unique.length; i += size) {
    const chunk = unique.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(snapshotFor))));
  }
  return out;
}

export async function searchItems(query: string) {
  const { items, fetchedAt } = await getAllItems();
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], fetchedAt };
  const scored = items
    .map((it) => {
      const name = it.i18n?.["en"]?.name ?? it.slug;
      const lower = name.toLowerCase();
      if (lower === q) return { it, name, rank: 0 };
      if (lower.startsWith(q)) return { it, name, rank: 1 };
      if (lower.includes(q)) return { it, name, rank: 2 };
      if (it.slug.includes(q.replace(/\s+/g, "_"))) return { it, name, rank: 3 };
      return null;
    })
    .filter((x): x is { it: (typeof items)[number]; name: string; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank || a.name.length - b.name.length)
    .slice(0, 40);

  return {
    fetchedAt,
    results: scored.map(({ it, name }) => ({
      slug: it.slug,
      name,
      thumb: it.i18n?.["en"]?.thumb,
      tags: it.tags ?? [],
      ...classify(it.tags ?? [], it.slug),
    })),
  };
}

export async function itemDetail(slug: string) {
  const snapshot = await snapshotFor(slug);
  try {
    const { item } = await getItem(slug);
    snapshot.ducats = item.ducats;
  } catch {
    /* metadata is optional */
  }
  const { orders } = await getOrders(slug).catch(() => ({ orders: [] as WfmOrder[] }));
  let history: { date: string; median: number; avg: number; volume: number }[] = [];
  let historyError: string | null = null;
  try {
    const stats = await getStatistics(slug);
    history = stats.days90.slice(-90).map((p) => ({
      date: p.datetime.slice(0, 10),
      median: p.median,
      avg: p.avg_price,
      volume: p.volume,
    }));
  } catch (err) {
    historyError = err instanceof Error ? err.message : "History unavailable";
  }
  const recent = history.slice(-7);
  const volume7d = recent.reduce((a, b) => a + b.volume, 0);
  const weighted = recent.length ? recent.reduce((a, b) => a + b.avg * b.volume, 0) / Math.max(1, volume7d) : null;

  return {
    snapshot,
    orders: topOrders(orders),
    history,
    historyError,
    volume7d,
    weighted7d: weighted && Number.isFinite(weighted) ? Math.round(weighted * 10) / 10 : null,
  };
}

export async function rivenBoard(weaponSlugs: string[]) {
  const { weapons, fetchedAt } = await getRivenWeapons();
  const chosen = weapons.filter((w) => weaponSlugs.includes(w.slug));
  const rows = [];
  for (const w of chosen) {
    try {
      const { auctions, fetchedAt: af, stale } = await getRivenAuctions(w.slug);
      const live = auctions.filter((a) => !a.closed && a.visible !== false);
      const prices = live
        .map((a) => a.buyout_price ?? a.starting_price)
        .filter((p): p is number => typeof p === "number" && p > 0)
        .sort((a, b) => a - b);
      const median = prices.length ? prices[Math.floor(prices.length / 2)]! : null;
      const cheapest = prices[0] ?? null;
      rows.push({
        slug: w.slug,
        name: w.i18n?.["en"]?.name ?? w.slug,
        group: w.group,
        rivenType: w.rivenType,
        disposition: w.disposition,
        listings: live.length,
        onlineSellers: live.filter((a) => a.owner?.status === "ingame" || a.owner?.status === "online").length,
        cheapestBuyout: cheapest,
        medianBuyout: median,
        fetchedAt: af,
        stale,
        error: null as string | null,
      });
    } catch (err) {
      rows.push({
        slug: w.slug,
        name: w.i18n?.["en"]?.name ?? w.slug,
        group: w.group,
        rivenType: w.rivenType,
        disposition: w.disposition,
        listings: 0,
        onlineSellers: 0,
        cheapestBuyout: null,
        medianBuyout: null,
        fetchedAt: 0,
        stale: true,
        error: err instanceof Error ? err.message : "Auction data unavailable",
      });
    }
  }
  return { rows, fetchedAt };
}

export async function rivenWeaponList() {
  const { weapons, fetchedAt } = await getRivenWeapons();
  return {
    fetchedAt,
    weapons: weapons
      .map((w) => ({
        slug: w.slug,
        name: w.i18n?.["en"]?.name ?? w.slug,
        group: w.group,
        disposition: w.disposition,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
