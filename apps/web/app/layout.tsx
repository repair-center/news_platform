import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { api, fa } from './lib';

const vazir = Vazirmatn({ subsets: ['arabic', 'latin'], variable: '--font-vazir', display: 'swap' }); // SIL OFL licensed
const name = process.env.NEXT_PUBLIC_SITE_NAME ?? 'پلتفرم خبری';
const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const metadata: Metadata = { metadataBase: new URL(site), openGraph: { siteName: name, locale: 'fa_IR', type: 'website' }, title: { default: name, template: `%s | ${name}` }, description: 'خبرهای رسانه‌های ایرانی، همراه با منبع و زمان انتشار' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const health = await api<{ lastSuccessfulIngestion: string | null }>('/health');
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body className="font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="text-2xl font-bold text-brand">{name}</Link>
            <form action="/" role="search" className="flex w-full gap-2 sm:w-auto">
              <input name="q" type="search" aria-label="جست‌وجو در خبرها" placeholder="جست‌وجو در خبرها" className="w-full rounded border border-line bg-white px-3 py-1.5 sm:w-72" />
              <button className="rounded bg-brand px-4 py-1.5 text-white">جست‌وجو</button>
            </form>
          </div>
          <p className="mx-auto max-w-5xl px-4 pb-3 text-sm text-mute">
            {health?.lastSuccessfulIngestion ? `آخرین دریافت موفق خبر: ${fa(health.lastSuccessfulIngestion)}` : 'هنوز خبری دریافت نشده یا سرویس در دسترس نیست'}
          </p>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="border-t border-line py-6 text-center text-sm text-mute">عنوان و خلاصه هر خبر متعلق به رسانه منبع است؛ متن کامل را در سایت اصلی بخوانید.</footer>
      </body>
    </html>
  );
}
