/** Shared queue names and retry policy (pg-boss on the existing PostgreSQL; no Redis). */
export const INGEST_QUEUE = 'ingestion';

export const INGEST_RETRY = {
  retryLimit: 4,
  retryDelay: 30, // seconds
  retryBackoff: true, // exponential backoff
  expireInSeconds: 300,
} as const;
