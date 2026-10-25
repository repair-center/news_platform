import type { MetadataRoute } from 'next';
import { api, Article } from './lib';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await api<{ items: Article[] }>('/articles?page=1&pageSize=50');
  return [{ url: SITE, changeFrequency: 'hourly' }, ...(data?.items ?? []).map((a) => ({ url: `${SITE}/news/${a.id}`, lastModified: a.publishedAt ?? a.fetchedAt }))];
}
