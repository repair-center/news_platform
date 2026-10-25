import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, OnModuleDestroy, OnModuleInit, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import PgBoss from 'pg-boss';
import { z } from 'zod';
import { assertSafeUrl, diversify, INGEST_QUEUE, INGEST_RETRY, normalizeUrl, scoreArticle, toSearchKey, UnsafeUrlError } from '@news/core';
import { AdminGuard, PrismaService, parse } from './common';

@Injectable()
class QueueService implements OnModuleInit, OnModuleDestroy {
  // Producer only: the worker owns scheduling/maintenance. Uses the same PostgreSQL (no Redis).
  private boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, application_name: 'news-api', supervise: false, schedule: false });
  async onModuleInit() { await this.boss.start(); await this.boss.createQueue(INGEST_QUEUE); }
  async onModuleDestroy() { await this.boss.stop({ graceful: false }); }
  enqueueIngestion(sourceId: string) { return this.boss.send(INGEST_QUEUE, { sourceId, manual: true }, { ...INGEST_RETRY }); }
}

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().regex(/^[a-z0-9-]+$/).optional(),
  sort: z.enum(['latest', 'ranked']).default('latest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const publicSelect = {
  id: true, title: true, excerpt: true, imageUrl: true, url: true, publishedAt: true, fetchedAt: true, version: true, possibleDuplicateOfId: true,
  source: { select: { id: true, name: true, domain: true } }, category: { select: { slug: true, name: true } },
} as const;

@Controller()
class PublicController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  async health() {
    const [db, last, sources] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'ok', () => 'down'),
      this.prisma.newsSource.aggregate({ _max: { lastSuccessAt: true } }),
      this.prisma.newsSource.groupBy({ by: ['health'], where: { active: true }, _count: true }),
    ]);
    return { db, lastSuccessfulIngestion: last._max.lastSuccessAt, activeSourcesByHealth: sources.map((s) => ({ health: s.health, count: s._count })) };
  }

  @Get('categories')
  categories() { return this.prisma.category.findMany({ orderBy: { name: 'asc' } }); }

  @Get('articles')
  async list(@Query() raw: unknown) {
    const q = parse(listQuery, raw);
    const key = q.q ? toSearchKey(q.q) : undefined;
    const where = { status: 'PUBLISHED' as const, source: { active: true }, ...(q.category && { category: { slug: q.category } }), ...(key && { searchText: { contains: key } }) };
    const order = [{ publishedAt: { sort: 'desc' as const, nulls: 'last' as const } }, { fetchedAt: 'desc' as const }];
    const total = await this.prisma.article.count({ where });
    if (q.sort === 'latest') {
      const items = await this.prisma.article.findMany({ where, select: publicSelect, orderBy: order, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
      return { items, page: q.page, pageSize: q.pageSize, total };
    }
    // Rule-based ranking over the most recent 300 candidates, then topical diversification.
    const cand = await this.prisma.article.findMany({ where, select: publicSelect, orderBy: order, take: 300 });
    const scored = cand.map((a) => ({ item: a, score: scoreArticle({ publishedAt: a.publishedAt, fetchedAt: a.fetchedAt, completeness: (a.excerpt ? 0.5 : 0) + (a.imageUrl ? 0.5 : 0) }).score }));
    const ranked = diversify(scored, (a) => a.category?.slug ?? '-');
    return { items: ranked.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), page: q.page, pageSize: q.pageSize, total };
  }

  @Get('articles/:id')
  async one(@Param('id') id: string) {
    const a = await this.prisma.article.findFirst({ where: { id, status: 'PUBLISHED' }, select: { ...publicSelect, sourceUpdatedAt: true, revisions: { select: { version: true, changeType: true, reason: true, createdAt: true }, orderBy: { version: 'desc' } } } });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'خبر پیدا نشد' });
    return a;
  }
}

const sourceCreate = z.object({
  name: z.string().min(2).max(100), domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
  feedUrl: z.string().url(), method: z.enum(['RSS', 'ATOM', 'API', 'MANUAL']).default('RSS'),
  fetchIntervalMinutes: z.number().int().min(5).max(1440).default(15),
  termsNotes: z.string().min(10).max(2000), termsConfirmed: z.boolean().default(false), active: z.boolean().default(false),
});
const sourcePatch = sourceCreate.partial();

@Controller('admin')
@UseGuards(AdminGuard)
class AdminController {
  constructor(private prisma: PrismaService, private queues: QueueService) {}

  private async checked<T extends { feedUrl?: string; active?: boolean; termsConfirmed?: boolean }>(d: T) {
    if (d.feedUrl) {
      try { await assertSafeUrl(d.feedUrl); } catch (e) { if (e instanceof UnsafeUrlError) throw new BadRequestException({ code: 'UNSAFE_URL', message: e.message }); throw e; }
    }
    return d;
  }
  private audit(action: string, target: string, meta?: object) { return this.prisma.auditLog.create({ data: { action, target, meta } }); }

  @Get('dashboard')
  async dashboard() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [articles, today, active, failing, runs] = await Promise.all([
      this.prisma.article.count(), this.prisma.article.count({ where: { fetchedAt: { gte: start } } }),
      this.prisma.newsSource.count({ where: { active: true } }), this.prisma.newsSource.count({ where: { health: 'FAILING' } }),
      this.prisma.ingestionRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
    ]);
    return { articles, fetchedToday: today, activeSources: active, failingSources: failing, recentRuns: runs };
  }

  @Get('sources') sources() { return this.prisma.newsSource.findMany({ orderBy: { name: 'asc' } }); }

  @Post('sources')
  async create(@Body() raw: unknown) {
    const d = await this.checked(parse(sourceCreate, raw));
    if (d.active && !d.termsConfirmed) throw new BadRequestException({ code: 'TERMS_REQUIRED', message: 'برای فعال‌سازی باید شرایط استفاده منبع تأیید شود' });
    const s = await this.prisma.newsSource.create({ data: { ...d, domain: d.domain.toLowerCase() } });
    await this.audit('source.create', s.id, { domain: s.domain });
    return s;
  }

  @Patch('sources/:id')
  async update(@Param('id') id: string, @Body() raw: unknown) {
    const d = await this.checked(parse(sourcePatch, raw));
    const cur = await this.prisma.newsSource.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException({ code: 'NOT_FOUND', message: 'منبع پیدا نشد' });
    if ((d.active ?? cur.active) && !(d.termsConfirmed ?? cur.termsConfirmed)) throw new BadRequestException({ code: 'TERMS_REQUIRED', message: 'برای فعال‌سازی باید شرایط استفاده منبع تأیید شود' });
    const s = await this.prisma.newsSource.update({ where: { id }, data: d });
    await this.audit('source.update', id, { fields: Object.keys(d) });
    return s;
  }

  @Post('sources/:id/run')
  async run(@Param('id') id: string) {
    const s = await this.prisma.newsSource.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'منبع پیدا نشد' });
    await this.queues.enqueueIngestion(id);
    await this.audit('source.run', id);
    return { queued: true };
  }

  @Get('audit') audit_() { return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }); }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [PublicController, AdminController],
  providers: [PrismaService, QueueService, AdminGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
