import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/client/client.js';
import { DDL_PATH } from './generate.js';
import { startPostgres } from './postgres.js';

export interface TestDatabase {
  readonly prisma: PrismaClient;
  /** True on a real server, where several connections make real concurrency possible. */
  readonly real: boolean;
  /** The SQL Prisma sent since the last truncate. */
  readonly queries: string[];
  truncate(): Promise<void>;
  close(): Promise<void>;
}

const TABLES = [
  'public.outbox',
  'public.processed_events',
  'messaging.outbox',
  'messaging.processed_events',
  'billing_core.invoices',
  'read_side.criteria_contract',
  'public.stored_events',
  'public.stored_events_head',
  'public.stream_snapshots',
  'public.subscription_checkpoints',
  'public.subject_keys',
];

/** What the Prisma schema cannot say, and a migration of the project adds by hand: strings ordered by code point. */
const BINARY_ORDER = 'alter table read_side.criteria_contract alter column room type text collate "C"';

/**
 * One PostgreSQL database with the tables of the test schema, created by the DDL that
 * `prisma migrate diff` derived from the shipped fragment.
 */
export async function createDatabase(): Promise<TestDatabase> {
  const postgres = await startPostgres();
  const migration = new pg.Client({ connectionString: postgres.url });

  await migration.connect();
  await migration.query(await readFile(DDL_PATH, 'utf8'));
  await migration.query(BINARY_ORDER);
  await migration.end();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: postgres.url, max: postgres.poolSize }),
    log: [{ emit: 'event', level: 'query' }],
  });

  const queries: string[] = [];

  prisma.$on('query', (event) => {
    queries.push(event.query);
  });

  return {
    prisma,
    real: postgres.real,
    queries,
    truncate: async () => {
      await prisma.$executeRawUnsafe(`truncate table ${TABLES.join(', ')} restart identity`);
      queries.length = 0;
    },
    close: async () => {
      await prisma.$disconnect();
      await postgres.stop();
    },
  };
}
