# پلتفرم خبری ایران — نسخه ۰٫۱ (مراحل ۱ تا ۳ به‌صورت جزئی)

Modular monolith: `packages/core` (منطق خالص و آزمون‌شده)، `apps/api` (NestJS)، `apps/worker` (pg-boss + دریافت RSS)، `apps/web` (Next.js، RTL).
**بدون Docker و بدون Redis:** PostgreSQL مستقیم روی سیستم نصب می‌شود و صف پس‌زمینه با pg-boss روی همان PostgreSQL اجرا می‌شود.

## پیش‌نیاز
| ابزار | نسخه |
|---|---|
| Node.js | ≥ 20 (LTS) |
| npm | ≥ 10 |
| PostgreSQL (نصب مستقیم) | ≥ 14 |
| Git | هر نسخه |

بررسی پیش‌نیازها (فقط می‌خواند و چیزی نصب نمی‌کند):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-prereqs.ps1
```
macOS/Linux: `./scripts/check-prereqs.sh`

## نصب و اجرا (Windows / PowerShell)
```powershell
Copy-Item .env.example .env        # سپس .env را ویرایش کنید: رمز DATABASE_URL و ADMIN_API_TOKEN (≥ ۲۴ نویسه تصادفی)
npm install
```
ساخت نقش و پایگاه داده (با تأیید شما؛ یا دستی با psql):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1
```
سپس:
```powershell
npx prisma migrate dev --name init   # اولین Migration را می‌سازد و در prisma\migrations ذخیره می‌کند
npm run db:seed                      # فقط دسته‌بندی‌ها؛ هیچ خبر یا منبع ساختگی ساخته نمی‌شود
npm run build:core
npm run dev                          # API + Worker + Web هم‌زمان (concurrently)
```
یا هرکدام جدا در ترمینال خودش: `npm run dev:api`، `npm run dev:worker`، `npm run dev:web`.
مستند API: `http://localhost:4000/api/docs` — سایت: `http://localhost:3000`.

> جداول pg-boss (طرح `pgboss`) را خود pg-boss هنگام اولین اجرا می‌سازد و نیازی به Migration پریزما برای آن نیست.

### macOS/Linux
همان دستورها؛ فقط `Copy-Item .env.example .env` را با `cp .env.example .env` و ساخت پایگاه داده را با `psql` (مثلاً `createuser`/`createdb`) جایگزین کنید.

## افزودن منبع خبری
ابتدا شرایط استفاده و مجوز RSS/API رسانه را بررسی کنید و در `termsNotes` ثبت کنید. هیچ منبعی از قبل فعال نیست.
```powershell
$h = @{ Authorization = "Bearer $env:ADMIN_API_TOKEN" }
$body = @{ name='نام رسانه'; domain='example.ir'; feedUrl='https://example.ir/rss'; termsNotes='مجوز/شرایط استفاده: ...'; termsConfirmed=$true; active=$true } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/admin/sources -Headers $h -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/admin/sources/<id>/run -Headers $h
```
(`$env:ADMIN_API_TOKEN` را قبلاً در همان نشست PowerShell مقداردهی کنید.)

## آزمون
```powershell
npm run typecheck
npm test            # آزمون‌های واحد packages/core
```

## ساخت تولید، پشتیبان‌گیری، بازیابی
```powershell
npm run build
npx prisma migrate deploy
npm run start:api; npm run start:worker; npm run start:web   # هرکدام در یک پردازش/سرویس جدا
pg_dump -U news -h localhost -Fc news -f backup.dump          # پشتیبان
pg_restore -U news -h localhost -d news --clean backup.dump   # بازیابی
```
جزئیات: `docs/deployment.md`.

## عیب‌یابی
- `ADMIN_DISABLED`: مقدار `ADMIN_API_TOKEN` خالی یا کوتاه‌تر از ۲۴ نویسه است.
- `password authentication failed`: رمز داخل `DATABASE_URL` با رمز نقش PostgreSQL یکی نیست.
- `prisma migrate dev` خطای shadow database می‌دهد: به نقش `CREATEDB` بدهید (`ALTER ROLE news CREATEDB;`).
- خبری نمایش داده نمی‌شود: منبع باید `active` و `termsConfirmed` باشد؛ وضعیت در `/api/v1/admin/dashboard`.

## وضعیت واقعی قابلیت‌ها
**هیچ‌کدام از موارد زیر در این محیط اجرا یا Build نشده‌اند** (نصب وابستگی‌ها و PostgreSQL در دسترس نبود)؛ فقط کد نوشته شده است.

| بخش | وضعیت |
|---|---|
| نرمال‌سازی فارسی، نرمال‌سازی URL، محافظ SSRF، تشخیص تکرار، رتبه‌بندی قاعده‌محور | پیاده‌سازی و آزمون واحد نوشته شده (قبلاً گزارش‌شده: ۳۲ آزمون؛ در این نشست دوباره اجرا نشد) |
| مدل داده (Prisma) | نوشته شده، Migration ساخته/اجرا نشده |
| صف پس‌زمینه | به pg-boss منتقل شد؛ اجرا نشده |
| API خبرها/دسته‌ها/سلامت/مدیریت منابع/داشبورد/audit | نوشته شده، اجرا نشده |
| دریافت RSS با صف، retry، ثبت اجرا و سلامت منبع | نوشته شده، اجرا نشده |
| رابط فارسی RTL: صفحه اصلی، جست‌وجو، جزئیات خبر | نوشته شده، اجرا نشده |
| SEO: robots، sitemap، canonical، OpenGraph، JSON-LD خبر | نوشته شده، اجرا نشده |
| احراز هویت کاربران/نقش‌ها | **انجام نشده**؛ فقط توکن موقت مدیر (قبل از استقرار باید جایگزین شود) |
| خلاصه‌سازی، حقیقت‌سنجی، تایم‌لاین، مقایسه رسانه‌ها، فید شخصی، ذخیره خبر، اعلان، حالت مطالعه، پوشش زنده، تأثیر خبر | **انجام نشده** (فقط جدول‌های داده برای برخی) |
| لایه AI Provider | **انجام نشده** |
| صفحات دسته‌بندی، رویداد، پروفایل، پنل مدیریت (UI)، درباره/تماس/حریم خصوصی | **انجام نشده** |
| جست‌وجو | فعلاً `contains` روی متن نرمال‌شده؛ ارتقا به GIN/pg_trgm یا Meilisearch |
| آزمون‌های یکپارچگی/E2E/امنیتی، پشتیبان‌گیری خودکار، استقرار | **انجام نشده** |
"# news_platform" 
