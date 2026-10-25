export interface RankInput {
  publishedAt: Date | null;
  fetchedAt: Date;
  interest?: number;            // 0..1 match with user's followed topics
  importance?: number;          // 0..1 editorial/rule-based
  completeness?: number;        // 0..1 (title, excerpt, image present)
  independentSources?: number;  // count of independent reports (shared origin counts once)
}
export const DEFAULT_WEIGHTS = { freshness: 0.4, interest: 0.2, importance: 0.15, completeness: 0.1, independence: 0.15 };
const HALF_LIFE_HOURS = 12;

export function scoreArticle(i: RankInput, now = new Date(), w = DEFAULT_WEIGHTS) {
  // Unknown publish time: rank by fetch time but never above 0.5 freshness, so it can't pose as fresh news.
  const ref = i.publishedAt ?? i.fetchedAt;
  const ageH = Math.max(0, (now.getTime() - ref.getTime()) / 36e5);
  const fresh = Math.pow(0.5, ageH / HALF_LIFE_HOURS) * (i.publishedAt ? 1 : 0.5);
  const parts = {
    freshness: fresh,
    interest: clamp(i.interest ?? 0),
    importance: clamp(i.importance ?? 0),
    completeness: clamp(i.completeness ?? 0),
    independence: Math.min(i.independentSources ?? 1, 3) / 3,
  };
  const score = Object.entries(parts).reduce((s, [k, v]) => s + v * (w as Record<string, number>)[k], 0);
  return { score, parts };
}

/** Greedy re-rank that penalizes repeats of the same key (e.g. category) to keep topical variety. */
export function diversify<T>(items: Array<{ item: T; score: number }>, keyOf: (t: T) => string, penalty = 0.15) {
  const seen = new Map<string, number>();
  const pool = [...items];
  const out: T[] = [];
  while (pool.length) {
    let best = 0, bestVal = -Infinity;
    pool.forEach((p, idx) => {
      const val = p.score - penalty * (seen.get(keyOf(p.item)) ?? 0);
      if (val > bestVal) { bestVal = val; best = idx; }
    });
    const [picked] = pool.splice(best, 1);
    seen.set(keyOf(picked.item), (seen.get(keyOf(picked.item)) ?? 0) + 1);
    out.push(picked.item);
  }
  return out;
}
const clamp = (n: number) => Math.min(1, Math.max(0, n));
