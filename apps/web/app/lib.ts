export const API = process.env.API_URL ?? 'http://localhost:4000';
export type Article = { id: string; title: string; excerpt: string | null; imageUrl: string | null; url: string; publishedAt: string | null; fetchedAt: string; version: number; possibleDuplicateOfId: string | null; source: { id: string; name: string; domain: string }; category: { slug: string; name: string } | null; revisions?: { version: number; changeType: string; reason: string | null; createdAt: string }[] };

const fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });
export const fa = (iso?: string | null) => (iso ? fmt.format(new Date(iso)) : 'نامشخص');

export async function api<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}/api/v1${path}`, { next: { revalidate: 60 } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}
