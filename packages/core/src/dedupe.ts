import { createHash } from 'node:crypto';
import { toSearchKey } from './persian';

export function contentHash(title: string, body: string): string {
  return createHash('sha256').update(toSearchKey(title) + '\n' + toSearchKey(body)).digest('hex');
}

/** Word-set Jaccard similarity of two titles after Persian normalization (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(toSearchKey(a).split(' ').filter(Boolean));
  const tb = new Set(toSearchKey(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export type DuplicateVerdict = 'same-url' | 'same-content' | 'likely-same-story' | 'distinct';

/** Never deletes: a 'likely-same-story' verdict must only flag the article for review/grouping. */
export function classifyDuplicate(
  a: { urlNormalized: string; contentHash: string; title: string; publishedAt?: Date | null },
  b: { urlNormalized: string; contentHash: string; title: string; publishedAt?: Date | null },
  opts = { titleThreshold: 0.8, windowHours: 72 },
): DuplicateVerdict {
  if (a.urlNormalized === b.urlNormalized) return 'same-url';
  if (a.contentHash === b.contentHash) return 'same-content';
  if (a.publishedAt && b.publishedAt) {
    const hours = Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / 36e5;
    if (hours > opts.windowHours) return 'distinct';
  }
  return titleSimilarity(a.title, b.title) >= opts.titleThreshold ? 'likely-same-story' : 'distinct';
}
