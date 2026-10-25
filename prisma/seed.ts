import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const categories = [['politics','سیاسی'],['economy','اقتصادی'],['society','اجتماعی'],['culture','فرهنگی و هنری'],['sports','ورزشی'],['science-tech','علم و فناوری'],['world','بین‌الملل (گزارش رسانه‌های ایرانی)']];
async function main() {
  for (const [slug, name] of categories) await prisma.category.upsert({ where: { slug }, update: { name }, create: { slug, name } });
  console.log('categories seeded (no articles or sources are fabricated)');
}
main().finally(() => prisma.$disconnect());
