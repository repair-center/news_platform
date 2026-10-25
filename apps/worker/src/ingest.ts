import { NewsSource, PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';
import { assertSafeUrl, classifyDuplicate, contentHash, normalizePersian, normalizeUrl, stripHtml, toSearchKey } from '@news/core';

const MAX_BYTES = 5 * 1024 * 1024;
const parser = new Parser();
const UA = process.env.USER_AGENT ?? 'NewsPlatformBot/0.1';

/** Fetches with timeout, size cap, and SSRF validation on every redirect hop. */
export async function safeFetchText(url: string, timeoutMs = 15_000): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { current = new URL(res.headers.get('location')!, current).toString(); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('پاسخ بیش از حد بزرگ است');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('پاسخ بیش از حد بزرگ است');
    return text;
  }
  throw new Error('تعداد ریدایرکت بیش از حد');
}

const safeDate = (v?: string) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) || d.getTime() > Date.now() + 36e5 ? null : d; };
const safeImageUrl = (v?: string) => { try { const u = new URL(v ?? ''); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; } };

export async function ingestSource(prisma: PrismaClient, source: NewsSource) {
  const run = await prisma.ingestionRun.create({ data: { sourceId: source.id } });
  const stats = { seen: 0, created: 0, updated: 0, flagged: 0, failedItems: 0 };
  await prisma.newsSource.update({ where: { id: source.id }, data: { lastAttemptAt: new Date() } });
  try {
    const feed = await parser.parseString(await safeFetchText(source.feedUrl));
    for (const item of feed.items ?? []) {
      stats.seen++;
      try {
        if (!item.link || !item.title) { stats.failedItems++; continue; }
        const urlNormalized = normalizeUrl(item.link);
        const title = normalizePersian(stripHtml(item.title));
        const excerpt = normalizePersian(stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? '')).slice(0, 600) || null;
        const hash = contentHash(title, excerpt ?? '');
        const publishedAt = safeDate(item.isoDate ?? item.pubDate);
        const imageUrl = safeImageUrl(item.enclosure?.url);
        const searchText = toSearchKey(`${title} ${excerpt ?? ''}`);

        const existing = await prisma.article.findUnique({ where: { sourceId_urlNormalized: { sourceId: source.id, urlNormalized } } });
        if (existing) {
          if (existing.contentHash === hash) continue; // idempotent: nothing changed
          const changed: string[] = [];
          if (existing.title !== title) changed.push('title');
          if (existing.excerpt !== excerpt) changed.push('excerpt');
          await prisma.$transaction([
            prisma.articleRevision.create({ data: { articleId: existing.id, version: existing.version + 1, changeType: changed.includes('title') ? 'TITLE' : 'TEXT', changedFields: { fields: changed, previous: { title: existing.title, excerpt: existing.excerpt } } } }),
            prisma.article.update({ where: { id: existing.id }, data: { title, excerpt, contentHash: hash, searchText, version: { increment: 1 }, sourceUpdatedAt: new Date() } }),
          ]);
          stats.updated++;
          continue;
        }
        // Flag (never delete) likely duplicates from other sources in the last 72h.
        const since = new Date(Date.now() - 72 * 36e5);
        const recent = await prisma.article.findMany({ where: { fetchedAt: { gte: since }, sourceId: { not: source.id } }, select: { id: true, urlNormalized: true, contentHash: true, title: true, publishedAt: true }, take: 500 });
        let dupOf: string | null = null;
        for (const r of recent) if (classifyDuplicate({ urlNormalized, contentHash: hash, title, publishedAt }, r) !== 'distinct') { dupOf = r.id; break; }
        await prisma.article.create({ data: { sourceId: source.id, guid: item.guid ?? null, url: item.link, urlNormalized, title, excerpt, imageUrl, searchText, contentHash: hash, publishedAt, possibleDuplicateOfId: dupOf, duplicateScore: dupOf ? 1 : null } });
        stats.created++; if (dupOf) stats.flagged++;
      } catch (e) { stats.failedItems++; console.warn(`[${source.domain}] item skipped:`, (e as Error).message); }
    }
    const status = stats.failedItems > 0 && stats.failedItems === stats.seen ? 'FAILED' : stats.failedItems > 0 ? 'PARTIAL' : 'SUCCESS';
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), itemsSeen: stats.seen, itemsNew: stats.created, itemsUpdated: stats.updated, itemsFlagged: stats.flagged } });
    await prisma.newsSource.update({ where: { id: source.id }, data: status === 'FAILED' ? { health: 'DEGRADED', lastError: 'همه آیتم‌ها نامعتبر بودند' } : { health: 'HEALTHY', lastSuccessAt: new Date(), lastError: null } });
    return stats;
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), error: msg } });
    await prisma.newsSource.update({ where: { id: source.id }, data: { health: 'FAILING', lastError: msg } });
    throw e; // lets pg-boss retry with exponential backoff
  }
}
