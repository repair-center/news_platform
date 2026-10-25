# معماری
Modular monolith در یک مخزن npm workspaces:
- `packages/core`: توابع خالص (نرمال‌سازی فارسی/URL، SSRF، تشخیص تکرار، رتبه‌بندی، ثابت‌های صف). بدون وابستگی به چارچوب.
- `apps/api`: NestJS، پیشوند `/api/v1`، OpenAPI در `/api/docs`، تولیدکننده (producer) صف pg-boss.
- `apps/worker`: مصرف‌کننده pg-boss، زمان‌بندی دریافت منابع، دریافت RSS و ذخیره.
- `apps/web`: Next.js (RSC)، RTL، بدون کلید محرمانه.
- PostgreSQL نصب‌شده مستقیم: داده + صف (طرح `pgboss`). Docker، Compose و Redis استفاده نمی‌شوند.
جریان دریافت: scheduler (هر دقیقه) → `boss.send` با `singletonKey` → worker → `ingestSource` → ذخیره/ثبت اجرا/سلامت منبع. خطا ⇒ retry نمایی (۴ بار).
