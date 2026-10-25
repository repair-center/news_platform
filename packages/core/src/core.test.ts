import { describe, it, expect } from 'vitest';
import { normalizePersian, toSearchKey, toPersianDigits, stripHtml, normalizeUrl, isPrivateAddress, assertSafeUrl, UnsafeUrlError, contentHash, titleSimilarity, classifyDuplicate, scoreArticle, diversify } from './index';

describe('persian', () => {
  it('unifies Arabic ي/ك and digits', () => {
    expect(normalizePersian('كتاب يك ٣ و ۴')).toBe('کتاب یک 3 و 4');
  });
  it('removes diacritics, tatweel and bidi marks', () => {
    expect(normalizePersian('سَلاـم\u200f')).toBe('سلام');
  });
  it('cleans ZWNJ edges and duplicates', () => {
    expect(normalizePersian('\u200cمی\u200c\u200cشود\u200c')).toBe('می\u200cشود');
  });
  it('search key treats ZWNJ as space and drops punctuation', () => {
    expect(toSearchKey('می‌شود؟ «خبر»!')).toBe('می شود خبر');
  });
  it('converts to Persian digits', () => expect(toPersianDigits(2026)).toBe('۲۰۲۶'));
  it('strips html', () => expect(stripHtml('<p>سلام &amp; <b>دنیا</b><script>x()</script></p>')).toBe('سلام & دنیا'));
});

describe('url', () => {
  it('drops tracking, fragment, default port, trailing slash and sorts params', () => {
    expect(normalizeUrl('HTTPS://Example.IR:443/a/b/?utm_source=x&z=1&a=2#top')).toBe('https://example.ir/a/b?a=2&z=1');
  });
});

describe('ssrf', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1'])('blocks %s', (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
  const pub = async () => ['93.184.216.34'];
  it('accepts public https', async () => { await expect(assertSafeUrl('https://example.ir/feed', pub)).resolves.toBeInstanceOf(URL); });
  it('rejects bad schemes, credentials, ports', async () => {
    for (const u of ['file:///etc/passwd', 'ftp://a.ir', 'https://u:p@a.ir', 'http://a.ir:8080/x']) await expect(assertSafeUrl(u, pub)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
  it('rejects hosts resolving to internal IPs or mixed results', async () => {
    await expect(assertSafeUrl('https://evil.ir', async () => ['127.0.0.1'])).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeUrl('https://evil.ir', async () => ['8.8.8.8', '10.0.0.1'])).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe('dedupe', () => {
  it('hash ignores Arabic/Persian letter variants', () => expect(contentHash('كتاب', 'يك')).toBe(contentHash('کتاب', 'یک')));
  it('title similarity', () => {
    expect(titleSimilarity('افزایش قیمت بنزین از فردا', 'افزایش قیمت بنزین از فردا اعلام شد')).toBeGreaterThan(0.7);
    expect(titleSimilarity('افزایش قیمت بنزین', 'پیروزی تیم ملی')).toBe(0);
  });
  const base = { urlNormalized: 'https://a.ir/1', contentHash: 'h1', title: 'افزایش قیمت بنزین از فردا', publishedAt: new Date('2026-01-01T10:00:00Z') };
  it('verdicts', () => {
    expect(classifyDuplicate(base, { ...base })).toBe('same-url');
    expect(classifyDuplicate(base, { ...base, urlNormalized: 'https://b.ir/2' })).toBe('same-content');
    expect(classifyDuplicate(base, { ...base, urlNormalized: 'https://b.ir/2', contentHash: 'h2' })).toBe('likely-same-story');
    expect(classifyDuplicate(base, { ...base, urlNormalized: 'https://b.ir/2', contentHash: 'h2', title: 'خبر دیگر' })).toBe('distinct');
    expect(classifyDuplicate(base, { ...base, urlNormalized: 'https://b.ir/2', contentHash: 'h2', publishedAt: new Date('2026-02-01T10:00:00Z') })).toBe('distinct');
  });
});

describe('rank', () => {
  const now = new Date('2026-01-02T00:00:00Z');
  it('fresher beats older, all else equal', () => {
    const a = scoreArticle({ publishedAt: new Date('2026-01-01T23:00:00Z'), fetchedAt: now }, now).score;
    const b = scoreArticle({ publishedAt: new Date('2025-12-30T00:00:00Z'), fetchedAt: now }, now).score;
    expect(a).toBeGreaterThan(b);
  });
  it('missing publish date cannot look fresher than a dated equivalent', () => {
    const dated = scoreArticle({ publishedAt: now, fetchedAt: now }, now).parts.freshness;
    const undated = scoreArticle({ publishedAt: null, fetchedAt: now }, now).parts.freshness;
    expect(undated).toBeLessThan(dated);
  });
  it('shared-origin reports do not count as extra independent confirmation', () => {
    const one = scoreArticle({ publishedAt: now, fetchedAt: now, independentSources: 1 }, now).score;
    const three = scoreArticle({ publishedAt: now, fetchedAt: now, independentSources: 3 }, now).score;
    expect(three).toBeGreaterThan(one);
  });
  it('diversify spreads categories', () => {
    const items = [{ item: 'p1', score: 1 }, { item: 'p2', score: 0.95 }, { item: 'e1', score: 0.9 }].map((x) => ({ ...x }));
    expect(diversify(items, (s) => s[0], 0.2)).toEqual(['p1', 'e1', 'p2']);
  });
});
