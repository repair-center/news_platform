import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';
import { INGEST_QUEUE, INGEST_RETRY } from '@news/core';
import { ingestSource } from './ingest';

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, application_name: 'news-worker' });
boss.on('error', (e) => console.error('pg-boss error:', e.message));

type IngestJob = { sourceId: string; manual?: boolean };

async function handle(data: IngestJob) {
  const source = await prisma.newsSource.findUnique({ where: { id: data.sourceId } });
  if (!source) return;
  if (!source.active && !data.manual) return;
  if (!source.termsConfirmed) return; // never fetch a source whose terms were not confirmed (no retry)
  return ingestSource(prisma, source);
}

/** Enqueue sources that are due. singletonKey+singletonSeconds => at most one job per source per interval (idempotent). */
async function schedule() {
  const sources = await prisma.newsSource.findMany({ where: { active: true, termsConfirmed: true } });
  for (const s of sources) {
    const intervalSec = s.fetchIntervalMinutes * 60;
    const due = !s.lastAttemptAt || Date.now() - s.lastAttemptAt.getTime() >= intervalSec * 1000;
    if (!due) continue;
    await boss.send(INGEST_QUEUE, { sourceId: s.id } satisfies IngestJob, { ...INGEST_RETRY, singletonKey: s.id, singletonSeconds: intervalSec });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL تنظیم نشده است');
  await boss.start();
  await boss.createQueue(INGEST_QUEUE);
  await boss.work<IngestJob>(INGEST_QUEUE, { batchSize: 1, pollingIntervalSeconds: 5 }, async (jobs) => {
    for (const job of jobs) await handle(job.data); // a thrown error => pg-boss retries with backoff
  });
  const tick = () => schedule().catch((e) => console.error('schedule error:', (e as Error).message));
  setInterval(tick, 60_000);
  tick();
  console.log('worker started (pg-boss)');

  const stop = async () => { await boss.stop({ graceful: true, timeout: 20_000 }); await prisma.$disconnect(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
main().catch((e) => { console.error('worker failed to start:', (e as Error).message); process.exit(1); });
