# استقرار (بدون Docker)
1. نصب Node.js و PostgreSQL روی سرور؛ ساخت نقش/پایگاه داده.
2. `.env` تولیدی (اسرار واقعی، `NEXT_PUBLIC_SITE_URL`)، `npm ci`, `npm run build`, `npx prisma migrate deploy`.
3. اجرای `start:api`، `start:worker`، `start:web` به‌صورت سرویس (Windows: NSSM/Task Scheduler؛ Linux: systemd) و reverse proxy با HTTPS.
4. پایش: `GET /api/v1/health`. پشتیبان: `pg_dump -Fc` زمان‌بندی‌شده؛ بازگشت: نسخه قبلی کد + `pg_restore` در صورت نیاز.
