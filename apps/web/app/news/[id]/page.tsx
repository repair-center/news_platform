import { notFound } from 'next/navigation';
import { api, fa, Article } from '../../lib';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const a = await api<Article>(`/articles/${encodeURIComponent(params.id)}`);
  return { title: a?.title ?? 'خبر', description: a?.excerpt ?? undefined, alternates: { canonical: `/news/${params.id}` }, openGraph: { title: a?.title, description: a?.excerpt ?? undefined, type: 'article' as const, publishedTime: a?.publishedAt ?? undefined } };
}

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const a = await api<Article>(`/articles/${encodeURIComponent(params.id)}`);
  if (!a) notFound();
  const ld = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, datePublished: a.publishedAt ?? undefined, dateModified: a.revisions?.[0]?.createdAt ?? a.publishedAt ?? undefined, publisher: { '@type': 'Organization', name: a.source.name }, isBasedOn: a.url, inLanguage: 'fa' };
  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <h1 className="text-2xl font-bold leading-10">{a.title}</h1>
      {a.excerpt && <p className="mt-4 text-lg">{a.excerpt}</p>}
      <a href={a.url} rel="noopener noreferrer nofollow" target="_blank" className="mt-4 inline-block rounded bg-brand px-4 py-2 text-white">خواندن متن کامل در {a.source.name}</a>
      <section aria-labelledby="prov" className="mt-8 border-t border-line pt-4">
        <h2 id="prov" className="mb-2 font-bold">شناسنامه خبر</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-mute">
          <dt>رسانه</dt><dd>{a.source.name} ({a.source.domain})</dd>
          <dt>زمان انتشار</dt><dd>{fa(a.publishedAt)}</dd>
          <dt>زمان دریافت</dt><dd>{fa(a.fetchedAt)}</dd>
          <dt>وضعیت بررسی</dt><dd>بررسی صحت انجام نشده (قابلیت هنوز پیاده‌سازی نشده)</dd>
        </dl>
        {a.revisions && a.revisions.length > 0 && (
          <>
            <h3 className="mt-4 font-bold">تاریخچه اصلاحات</h3>
            <ul className="text-mute">{a.revisions.map((r) => <li key={r.version}>نسخه {r.version}، {fa(r.createdAt)}{r.reason ? `: ${r.reason}` : ''}</li>)}</ul>
          </>
        )}
      </section>
    </article>
  );
}
