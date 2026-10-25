/**
 * افزودن منابع RSS خبری ایران به جدول NewsSource
 *
 * مسیر فایل: news-platform/prisma/seed-sources.ts
 *
 * ۱) تست سالم بودن لینک‌ها (چیزی در دیتابیس نمی‌نویسد):
 *      npx tsx prisma/seed-sources.ts --check
 *
 * ۲) ثبت منابع به‌صورت غیرفعال (امن):
 *      npx tsx prisma/seed-sources.ts
 *
 * ۳) ثبت و فعال‌سازی (یعنی شما شرایط استفاده‌ی هر منبع را بررسی و تأیید کرده‌اید):
 *      CONFIRM_TERMS=yes npx tsx prisma/seed-sources.ts
 *      (در PowerShell:  $env:CONFIRM_TERMS="yes"; npx tsx prisma/seed-sources.ts)
 *
 * نکته: در این پروژه هر domain فقط یک بار می‌تواند ثبت شود (unique).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Src = { name: string; domain: string; feedUrl: string; minutes?: number };

const SOURCES: Src[] = [
  // ── خبرگزاری‌های عمومی ──
  { name: 'ایسنا', domain: 'isna.ir', feedUrl: 'https://www.isna.ir/rss' },
  { name: 'ایرنا', domain: 'irna.ir', feedUrl: 'https://www.irna.ir/rss' },
  { name: 'خبرگزاری مهر', domain: 'mehrnews.com', feedUrl: 'https://www.mehrnews.com/rss' },
  { name: 'ایلنا', domain: 'ilna.ir', feedUrl: 'https://www.ilna.ir/rss' },
  { name: 'باشگاه خبرنگاران جوان', domain: 'yjc.ir', feedUrl: 'https://www.yjc.ir/fa/rss/allnews' },
  { name: 'خبرگزاری میزان', domain: 'mizanonline.ir', feedUrl: 'https://www.mizanonline.ir/fa/rss/allnews' },

  // ── پایگاه‌های خبری و روزنامه‌ها ──
  { name: 'خبرآنلاین', domain: 'khabaronline.ir', feedUrl: 'https://www.khabaronline.ir/rss' },
  { name: 'همشهری آنلاین', domain: 'hamshahrionline.ir', feedUrl: 'https://www.hamshahrionline.ir/rss' },
  { name: 'انتخاب', domain: 'entekhab.ir', feedUrl: 'https://www.entekhab.ir/fa/rss/allnews' },
  { name: 'تابناک', domain: 'tabnak.ir', feedUrl: 'https://www.tabnak.ir/fa/rss/allnews' },
  { name: 'عصر ایران', domain: 'asriran.com', feedUrl: 'https://www.asriran.com/fa/rss/allnews' },
  { name: 'خبر فوری', domain: 'khabarfoori.com', feedUrl: 'https://www.khabarfoori.com/rss' },

  // ── اقتصادی ──
  { name: 'اقتصادآنلاین', domain: 'eghtesadonline.com', feedUrl: 'https://www.eghtesadonline.com/rss' },
  { name: 'دنیای اقتصاد', domain: 'donya-e-eqtesad.com', feedUrl: 'https://donya-e-eqtesad.com/rss' },

  // ── ورزشی ──
  { name: 'ورزش۳', domain: 'varzesh3.com', feedUrl: 'https://www.varzesh3.com/rss/all' },

  // ── علم و فناوری ──
  { name: 'زومیت', domain: 'zoomit.ir', feedUrl: 'https://www.zoomit.ir/feed/' },
  { name: 'دیجیاتو', domain: 'digiato.com', feedUrl: 'https://digiato.com/feed' },
];

const TERMS_NOTES =
  'RSS عمومی منتشرشده توسط خود سایت. فقط عنوان، خلاصه و لینک ذخیره می‌شود. شرایط استفاده توسط اپراتور بررسی شود.';

async function checkFeeds() {
  console.log(`بررسی ${SOURCES.length} فید...\n`);
  let ok = 0;
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.feedUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': process.env.USER_AGENT ?? 'NewsPlatformBot/0.1', accept: 'application/rss+xml, application/xml, text/xml' },
      });
      const body = await res.text();
      const isFeed = /<item[\s>]|<entry[\s>]/i.test(body);
      if (res.ok && isFeed) { ok++; console.log(`✅ ${s.name.padEnd(24)} ${res.status}`); }
      else console.log(`❌ ${s.name.padEnd(24)} HTTP ${res.status} ${isFeed ? '' : '(فید معتبر نیست)'}  ${s.feedUrl}`);
    } catch (e) {
      console.log(`❌ ${s.name.padEnd(24)} ${(e as Error).message}  ${s.feedUrl}`);
    }
  }
  console.log(`\n${ok} از ${SOURCES.length} فید سالم بودند. لینک‌های ❌ را در لیست بالا اصلاح یا حذف کنید.`);
}

async function seed() {
  const confirmed = process.env.CONFIRM_TERMS === 'yes';
  let created = 0, updated = 0;
  for (const s of SOURCES) {
    const domain = s.domain.toLowerCase();
    const exists = await prisma.newsSource.findUnique({ where: { domain } });
    if (!exists) {
      await prisma.newsSource.create({
        data: {
          name: s.name, domain, feedUrl: s.feedUrl, method: 'RSS',
          fetchIntervalMinutes: s.minutes ?? 15,
          termsNotes: TERMS_NOTES, termsConfirmed: confirmed, active: confirmed,
        },
      });
      created++;
    } else if (confirmed && (!exists.active || !exists.termsConfirmed)) {
      await prisma.newsSource.update({ where: { domain }, data: { active: true, termsConfirmed: true } });
      updated++;
    }
  }
  console.log(`جدید: ${created} | فعال‌شده: ${updated} | کل لیست: ${SOURCES.length}`);
  if (!confirmed) console.log('منابع غیرفعال ثبت شدند. برای فعال‌سازی: CONFIRM_TERMS=yes npx tsx prisma/seed-sources.ts');
}

(process.argv.includes('--check') ? checkFeeds() : seed())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
