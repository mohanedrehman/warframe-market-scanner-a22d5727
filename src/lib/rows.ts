import {
  defaultFarmMinutes,
  scoreOpportunity,
  vaultStatus,
  type ItemSnapshot,
  type ScoreResult,
  type VaultStatus,
} from "./market-model";

export type OpportunityRow = {
  snap: ItemSnapshot;
  farmMinutes: number;
  farmMinutesIsUserSet: boolean;
  vault: VaultStatus;
  score: ScoreResult;
  spreadPct: number;
};

export function buildRow(snap: ItemSnapshot, farmTimes: Record<string, number>): OpportunityRow {
  const userSet = farmTimes[snap.slug];
  const farmMinutes = userSet ?? defaultFarmMinutes(snap);
  const instantValue = snap.highestBuy ?? 0;
  const askValue = snap.lowestSell ?? 0;
  const spreadPct = askValue > 0 && instantValue > 0 ? ((askValue - instantValue) / askValue) * 100 : 0;
  const score = scoreOpportunity({
    instantValue,
    askValue,
    spreadPct,
    onlineBuyers: snap.onlineBuyers,
    activity24h: snap.activity24h,
    farmMinutes,
  });
  return {
    snap,
    farmMinutes,
    farmMinutesIsUserSet: userSet !== undefined,
    vault: vaultStatus(snap.slug),
    score,
    spreadPct,
  };
}

export function buildRows(snaps: ItemSnapshot[], farmTimes: Record<string, number>) {
  return snaps.map((s) => buildRow(s, farmTimes)).sort((a, b) => b.score.total - a.score.total);
}
