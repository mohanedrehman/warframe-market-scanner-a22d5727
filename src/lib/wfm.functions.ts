import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  itemDetail,
  rivenBoard,
  rivenWeaponList,
  searchItems,
  snapshotMany,
} from "./analysis.server";

export const fetchSnapshots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slugs: z.array(z.string().min(1)).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const snapshots = await snapshotMany(data.slugs);
    return { snapshots, generatedAt: Date.now() };
  });

export const searchMarketItems = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().max(80) }).parse(input))
  .handler(async ({ data }) => searchItems(data.query));

export const fetchItemDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => itemDetail(data.slug));

export const fetchRivenBoard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ weapons: z.array(z.string()).max(12) }).parse(input))
  .handler(async ({ data }) => rivenBoard(data.weapons));

export const fetchRivenWeapons = createServerFn({ method: "GET" }).handler(async () => rivenWeaponList());
