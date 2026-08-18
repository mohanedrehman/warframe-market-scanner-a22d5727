/**
 * Server-only Warframe.Market API client.
 * - Global rate limiter (<= ~2.5 req/s, below the ~3 req/s guidance)
 * - Aggressive in-memory caching with stale fallback
 * - Retry with exponential backoff on 429 / 5xx
 */

const BASE = "https://api.warframe.market";
const MIN_INTERVAL_MS = 400; // 2.5 req/s ceiling
const USER_AGENT = "warframe-market-scanner/1.0 (personal analysis tool)";

type CacheEntry = { value: unknown; storedAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

let queueTail: Promise<void> = Promise.resolve();
let lastCallAt = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Serialise every outbound call through a single spaced queue. */
function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  });
  queueTail = run.catch(() => undefined);
  return run.then(fn);
}

async function rawFetch(path: string): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await schedule(() =>
        fetch(`${BASE}${path}`, {
          headers: {
            Accept: "application/json",
            Language: "en",
            Platform: "pc",
            "Crossplay": "true",
            "User-Agent": USER_AGENT,
          },
        }),
      );
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Warframe.Market responded ${res.status}`);
        await sleep(600 * Math.pow(2, attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Warframe.Market responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(400 * Math.pow(2, attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Warframe.Market request failed");
}

/** Cached GET. Returns cached value while fresh; on failure falls back to stale data. */
export async function cachedGet<T>(path: string, ttlMs: number): Promise<{ data: T; fetchedAt: number; stale: boolean }> {
  const hit = cache.get(path);
  const now = Date.now();
  if (hit && now - hit.storedAt < ttlMs) {
    return { data: hit.value as T, fetchedAt: hit.storedAt, stale: false };
  }
  const existing = inflight.get(path);
  if (existing) {
    const value = (await existing) as T;
    return { data: value, fetchedAt: cache.get(path)?.storedAt ?? now, stale: false };
  }
  const p = rawFetch(path)
    .then((value) => {
      cache.set(path, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  try {
    const value = (await p) as T;
    return { data: value, fetchedAt: cache.get(path)?.storedAt ?? Date.now(), stale: false };
  } catch (err) {
    if (hit) return { data: hit.value as T, fetchedAt: hit.storedAt, stale: true };
    throw err;
  }
}

/* ---------- API shapes (subset we use) ---------- */

export type WfmI18n = { name: string; icon?: string; thumb?: string; wikiLink?: string; description?: string };

export type WfmItemShort = {
  id: string;
  slug: string;
  tags: string[];
  i18n: Record<string, WfmI18n>;
};

export type WfmItemFull = WfmItemShort & {
  setRoot?: boolean;
  setParts?: string[];
  ducats?: number;
  reqMasteryRank?: number;
  tradingTax?: number;
  tradable?: boolean;
};

export type WfmOrder = {
  id: string;
  type: "buy" | "sell";
  platinum: number;
  quantity: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    ingameName: string;
    slug: string;
    reputation: number;
    status: "ingame" | "online" | "offline" | string;
    platform: string;
    lastSeen?: string;
  };
};

export type WfmStatPoint = {
  datetime: string;
  volume: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  wa_price: number;
  median: number;
};

export type WfmRivenWeapon = {
  id: string;
  slug: string;
  group: string;
  rivenType: string;
  disposition: number;
  reqMasteryRank: number;
  i18n: Record<string, WfmI18n>;
};

export type WfmAuction = {
  id: string;
  starting_price: number;
  buyout_price: number | null;
  top_bid: number | null;
  closed: boolean;
  visible: boolean;
  is_direct_sell: boolean;
  updated: string;
  owner: { ingame_name: string; status: string };
  item: { name?: string; mod_rank?: number; re_rolls?: number; polarity?: string; mastery_level?: number };
};

/* ---------- Endpoint helpers ---------- */

const TTL = {
  items: 12 * 60 * 60 * 1000,
  item: 6 * 60 * 60 * 1000,
  orders: 5 * 60 * 1000,
  stats: 30 * 60 * 1000,
  rivens: 12 * 60 * 60 * 1000,
  auctions: 10 * 60 * 1000,
};

export async function getAllItems() {
  const r = await cachedGet<{ data: WfmItemShort[] }>("/v2/items", TTL.items);
  return { items: r.data.data, fetchedAt: r.fetchedAt, stale: r.stale };
}

export async function getItem(slug: string) {
  const r = await cachedGet<{ data: WfmItemFull }>(`/v2/item/${slug}`, TTL.item);
  return { item: r.data.data, fetchedAt: r.fetchedAt, stale: r.stale };
}

export async function getOrders(slug: string) {
  const r = await cachedGet<{ data: WfmOrder[] }>(`/v2/orders/item/${slug}`, TTL.orders);
  return { orders: r.data.data ?? [], fetchedAt: r.fetchedAt, stale: r.stale };
}

export async function getStatistics(slug: string) {
  const r = await cachedGet<{
    payload: { statistics_closed: { "48hours": WfmStatPoint[]; "90days": WfmStatPoint[] } };
  }>(`/v1/items/${slug}/statistics`, TTL.stats);
  return {
    hours48: r.data.payload?.statistics_closed?.["48hours"] ?? [],
    days90: r.data.payload?.statistics_closed?.["90days"] ?? [],
    fetchedAt: r.fetchedAt,
    stale: r.stale,
  };
}

export async function getRivenWeapons() {
  const r = await cachedGet<{ data: WfmRivenWeapon[] }>("/v2/riven/weapons", TTL.rivens);
  return { weapons: r.data.data ?? [], fetchedAt: r.fetchedAt, stale: r.stale };
}

export async function getRivenAuctions(weaponSlug: string) {
  const r = await cachedGet<{ payload: { auctions: WfmAuction[] } }>(
    `/v1/auctions/search?type=riven&weapon_url_name=${encodeURIComponent(weaponSlug)}&sort_by=price_asc`,
    TTL.auctions,
  );
  return { auctions: r.data.payload?.auctions ?? [], fetchedAt: r.fetchedAt, stale: r.stale };
}
