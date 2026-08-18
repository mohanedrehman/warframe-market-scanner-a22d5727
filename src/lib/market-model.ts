/** Client-safe types, defaults and scoring maths. No network access here. */

export type Recommendation = "FARM" | "SELL NOW" | "HOLD" | "SKIP";

export type ActivityType =
  | "prime"
  | "corrupted-mod"
  | "syndicate"
  | "kuva-requiem"
  | "riven"
  | "arcane"
  | "other";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  prime: "Void Fissures / Prime parts",
  "corrupted-mod": "Corrupted Mods (Vaults)",
  syndicate: "Syndicate mods & wares",
  "kuva-requiem": "Kuva / Requiem / Liches",
  riven: "Rivens",
  arcane: "Arcanes / Eidolons",
  other: "Other",
};

export type ItemSnapshot = {
  slug: string;
  name: string;
  thumb?: string;
  tags: string[];
  category: string;
  activity: ActivityType;
  isSet: boolean;
  isComponent: boolean;
  ducats?: number;
  /** Highest active BUY order — what a buyer will pay you right now. */
  highestBuy: number | null;
  /** Lowest active SELL order — what sellers are asking. */
  lowestSell: number | null;
  spread: number | null;
  buyers: number;
  sellers: number;
  onlineBuyers: number;
  onlineSellers: number;
  /** Orders created/updated in the last 24h — liquidity proxy. */
  activity24h: number;
  fetchedAt: number;
  stale: boolean;
  error?: string;
};

/* ---------------- Farm time estimates ---------------- */
/**
 * IMPORTANT: these are USER ESTIMATES, not facts, and not sourced from drop
 * tables. They are editable in the UI and persisted locally. The shape is kept
 * deliberately simple so official/wiki drop-table data can replace it later.
 */
export type FarmTimeSource = "user-estimate" | "default-estimate" | "droptable";

export const DEFAULT_FARM_MINUTES: Record<ActivityType, number> = {
  prime: 35,
  "corrupted-mod": 20,
  syndicate: 90,
  "kuva-requiem": 45,
  riven: 25,
  arcane: 40,
  other: 45,
};

/** Per-item overrides (still labelled as estimates). */
export const DEFAULT_ITEM_FARM_MINUTES: Record<string, number> = {
  vauban_prime_set: 120,
  zephyr_prime_set: 120,
  yareli_prime_blueprint: 30,
  malignant_force: 20,
  transient_fortitude: 20,
  blind_rage: 18,
  narrow_minded: 18,
  overextended: 18,
  fleeting_expertise: 18,
  torid: 25,
  dual_toxocyst: 25,
};

export function defaultFarmMinutes(snap: { slug: string; activity: ActivityType }) {
  return DEFAULT_ITEM_FARM_MINUTES[snap.slug] ?? DEFAULT_FARM_MINUTES[snap.activity];
}

/* ---------------- Vault / Resurgence status ---------------- */
/**
 * The Warframe.Market API does not expose vault status. This is a small
 * manually curated list; anything not listed is reported as "unknown" rather
 * than guessed. Treat it as community knowledge, not an authoritative source.
 */
export type VaultStatus = "vaulted" | "available" | "unknown";
export const VAULT_CURATED: Record<string, VaultStatus> = {
  vauban_prime_set: "vaulted",
  zephyr_prime_set: "vaulted",
};
export const VAULT_CURATED_NOTE =
  "Manually curated, not from the API. Anything not on the list is shown as 'unknown'.";

export function vaultStatus(slug: string): VaultStatus {
  return VAULT_CURATED[slug] ?? "unknown";
}

/* ---------------- Classification ---------------- */

export function classify(tags: string[], slug: string): { category: string; activity: ActivityType } {
  const t = new Set(tags);
  if (t.has("riven")) return { category: "Riven", activity: "riven" };
  if (t.has("arcane_enhancement") || t.has("arcane")) return { category: "Arcane", activity: "arcane" };
  if (t.has("mod")) {
    if (t.has("corrupted")) return { category: "Corrupted Mod", activity: "corrupted-mod" };
    if (t.has("syndicate")) return { category: "Syndicate Mod", activity: "syndicate" };
    if (t.has("requiem") || slug.startsWith("kuva")) return { category: "Requiem Mod", activity: "kuva-requiem" };
    return { category: "Mod", activity: "other" };
  }
  if (t.has("prime")) {
    if (t.has("set")) return { category: "Prime Set", activity: "prime" };
    return { category: "Prime Part", activity: "prime" };
  }
  if (t.has("relic")) return { category: "Relic", activity: "prime" };
  if (t.has("weapon")) return { category: "Weapon / Part", activity: "other" };
  return { category: "Item", activity: "other" };
}

/** Items players cannot realistically farm and sell (cosmetics, bought goods). */
const NON_FARMABLE_TAGS = ["skin", "cosmetic", "sigil", "glyph", "captura", "syandana", "armor_piece", "color_palette"];

export function isFarmable(snap: ItemSnapshot) {
  if (snap.tags.some((t) => NON_FARMABLE_TAGS.includes(t))) return false;
  if (snap.category === "Riven") return false;
  return true;
}

/* ---------------- Opportunity scoring ---------------- */

export type ScoreInputs = {
  /** Plat you realistically receive now = highest active BUY order. */
  instantValue: number;
  /** Plat you could ask for = lowest active SELL order (patient sale). */
  askValue: number;
  spreadPct: number;
  onlineBuyers: number;
  activity24h: number;
  farmMinutes: number;
};

export type ScoreResult = {
  platPerHour: number;
  valueScore: number;
  demandScore: number;
  liquidityScore: number;
  spreadScore: number;
  total: number;
  recommendation: Recommendation;
  reason: string;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const logNorm = (x: number, cap: number) => clamp01(Math.log1p(Math.max(0, x)) / Math.log1p(cap));

/**
 * Transparent formula (all inputs shown in the UI):
 *   plat/hour   = instantValue x (60 / farmMinutes)
 *   value       = logNorm(plat/hour, 400)                 weight 45
 *   demand      = logNorm(onlineBuyers, 15)               weight 25
 *   liquidity   = logNorm(activity24h, 40)                weight 20
 *   spread      = clamp(spread% / 60%)                    weight 10
 *   total       = sum, 0-100
 */
export function scoreOpportunity(i: ScoreInputs): ScoreResult {
  const platPerHour = i.farmMinutes > 0 ? i.instantValue * (60 / i.farmMinutes) : 0;
  const valueScore = logNorm(platPerHour, 400) * 45;
  const demandScore = logNorm(i.onlineBuyers, 15) * 25;
  const liquidityScore = logNorm(i.activity24h, 40) * 20;
  const spreadScore = clamp01(i.spreadPct / 60) * 10;
  const total = valueScore + demandScore + liquidityScore + spreadScore;

  let recommendation: Recommendation = "SKIP";
  let reason = "Low value or no live demand — not worth your time right now.";

  if (i.instantValue <= 0 || i.onlineBuyers === 0) {
    recommendation = i.askValue >= 40 ? "HOLD" : "SKIP";
    reason =
      i.askValue >= 40
        ? "No online buyer right now, but sellers ask a decent price — list it and wait."
        : "No live buy orders and a low asking price.";
  } else if (i.instantValue >= 40 && i.onlineBuyers >= 3) {
    recommendation = "SELL NOW";
    reason = "Multiple online buyers at a solid price — you can offload immediately.";
  } else if (platPerHour >= 60 && i.activity24h >= 3) {
    recommendation = "FARM";
    reason = "Good plat per hour on your estimate with live trading activity.";
  } else if (i.spreadPct >= 35 && i.activity24h >= 2) {
    recommendation = "HOLD";
    reason = "Buyers are lowballing versus asking prices — list to sell rather than dumping.";
  } else if (platPerHour >= 30) {
    recommendation = "FARM";
    reason = "Reasonable return per hour with your current farm-time estimate.";
  }

  return { platPerHour, valueScore, demandScore, liquidityScore, spreadScore, total, recommendation, reason };
}

export const WATCHLIST_SLUGS = [
  "vauban_prime_set",
  "zephyr_prime_set",
  "yareli_prime_blueprint",
  "torid",
  "dual_toxocyst",
  "malignant_force",
  "transient_fortitude",
  "blind_rage",
  "narrow_minded",
  "overextended",
  "fleeting_expertise",
];

/** Broader pool used by the "What should I farm now?" scan. */
export const SCAN_SLUGS = [
  ...WATCHLIST_SLUGS,
  "primed_continuity",
  "corrosive_projection",
  "energy_conversion",
  "growing_power",
  "vigorous_swap",
  "rolling_guard",
  "adaptation",
  "nekros_prime_set",
  "saryn_prime_set",
  "mesa_prime_set",
  "wisp_prime_set",
  "gauss_prime_set",
  "octavia_prime_set",
  "khora_prime_set",
  "protea_prime_set",
  "baruuk_prime_set",
  "revenant_prime_set",
  "hildryn_prime_set",
  "nidus_prime_set",
  "harrow_prime_set",
  "gara_prime_set",
  "garuda_prime_set",
  "trinity_prime_set",
  "volt_prime_set",
  "rhino_prime_set",
  "loki_prime_set",
  "nova_prime_set",
  "ivara_prime_set",
  "titania_prime_set",
  "wukong_prime_set",
  "sevagoth_prime_set",
  "citrine_prime_set",
  "primed_flow",
  "stretch",
  "streamline",
  "intensify",
  "constitution",
  "vitality",
  "steel_charge",
  "hell_s_chamber",
  "serration",
  "split_chamber",
  "hornet_strike",
  "heavy_caliber",
  "vile_acceleration",
  "shred",
];

export function formatPlat(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("en-GB", { maximumFractionDigits: digits })}p`;
}

export function formatWhen(ts: number | null | undefined) {
  if (!ts) return "unknown";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/London",
  }).format(new Date(ts));
}
