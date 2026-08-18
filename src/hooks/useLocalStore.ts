import { useCallback, useEffect, useState } from "react";

/** localStorage-backed state that is SSR-safe (reads only after hydration). */
export function useLocalStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage full or unavailable */
        }
        return resolved;
      });
    },
    [key],
  );

  return { value, setValue: update, loaded };
}

export type FarmTimes = Record<string, number>;

export function useFarmTimes() {
  const { value, setValue, loaded } = useLocalStore<FarmTimes>("wfm.farmTimes.v1", {});
  const set = useCallback(
    (slug: string, minutes: number) =>
      setValue((prev) => ({ ...prev, [slug]: Math.max(1, Math.round(minutes)) })),
    [setValue],
  );
  const reset = useCallback((slug: string) => setValue((prev) => {
    const next = { ...prev };
    delete next[slug];
    return next;
  }), [setValue]);
  return { farmTimes: value, setFarmTime: set, resetFarmTime: reset, loaded };
}

export type InventoryEntry = { slug: string; name: string; quantity: number };

export function useInventory() {
  const { value, setValue, loaded } = useLocalStore<InventoryEntry[]>("wfm.inventory.v1", []);
  const upsert = useCallback(
    (entry: InventoryEntry) =>
      setValue((prev) => {
        const idx = prev.findIndex((e) => e.slug === entry.slug);
        if (idx === -1) return [...prev, entry];
        const next = [...prev];
        next[idx] = { ...next[idx]!, ...entry };
        return next;
      }),
    [setValue],
  );
  const remove = useCallback((slug: string) => setValue((prev) => prev.filter((e) => e.slug !== slug)), [setValue]);
  return { inventory: value, upsert, remove, loaded };
}
