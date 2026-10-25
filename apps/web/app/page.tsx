import Link from 'next/link';
import { api, fa, Article } from './lib';

type List = { items: Article[]; total: number; page: number; pageSize: number };

export default async function Home({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const q = (searchParams.q ?? '').slice(0, 200);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await api<List>(`/articles?page=${page}&pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ''}`);

  if (!data) return <p role="alert" className="text-alert">دریافت خبرها ممکن نشد. چند دقیقه دیگر دوباره تلاش کنید.</p>;
  if (data.items.length === 0) return <p className="text-mute">{q ? `خبری برای «${q}» پیدا نشد. عبارت دیگری را امتحان کنید.` : 'هنوز خبری ثبت نشده است. مدیر سایت باید یک منبع مجاز اضافه و فعال کند.'}</p>;

  return (
    <>
      <h1 className="mb-4 text-xl font-bold">{q ? `نتایج «${q}»` : 'تازه‌ترین خبرها'}</h1>
      <ul className="divide-y divide-line">
        {data.items.map((a, i) => (
          <li key={a.id} className="py-4">
            <Link href={`/news/${a.id}`} className={`${i === 0 && !q ? 'text-2xl' : 'text-lg'} font-bold hover:text-brand`}>{a.title}</Link>
            {a.excerpt && <p className="mt-1 text-mute">{a.excerpt}</p>}
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-mute">
              <span>منبع: {a.source.name}</span>
              <span>انتشار: {fa(a.publishedAt)}</span>
              <span>دریافت: {fa(a.fetchedAt)}</span>
              {a.version > 1 && <span className="text-brand">اصلاح‌شده</span>}
            </p>
          </li>
        ))}
      </ul>
      <nav className="mt-6 flex justify-between" aria-label="صفحه‌بندی">
        {page > 1 ? <Link href={`/?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>صفحه قبل</Link> : <span />}
        {page * data.pageSize < data.total && <Link href={`/?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>صفحه بعد</Link>}
      </nav>
    </>
  );
}
