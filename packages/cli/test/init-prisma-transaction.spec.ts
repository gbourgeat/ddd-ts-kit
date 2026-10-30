import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

describe('the transactions of a project on Prisma', () => {
  it('read how long a unit of work waits and runs from the environment, 10 and 30 seconds by default', () => {
    const root = initProject('--orm', 'prisma');

    expect(read(root, 'src/platform/config/load-config.ts')).toContain(
      "waitMs: env.integer('DATABASE_TRANSACTION_WAIT_MS', { fallback: 10_000, min: 1, max: 3_600_000 }),",
    );

    expect(read(root, 'src/platform/config/load-config.ts')).toContain(
      "timeoutMs: env.integer('DATABASE_TRANSACTION_TIMEOUT_MS', { fallback: 30_000, min: 1, max: 3_600_000 }),",
    );

    expect(read(root, '.env.example')).toContain(
      'DATABASE_TRANSACTION_WAIT_MS=10000\nDATABASE_TRANSACTION_TIMEOUT_MS=30000',
    );

    expect(read(root, 'src/platform/database/open-persistence.ts')).toContain(
      'return persistenceOver(client, config.databaseTransaction);',
    );

    expect(read(root, 'src/platform/database/persistence-over.ts')).toContain(
      'transaction === undefined ? undefined : { maxWait: transaction.waitMs, timeout: transaction.timeoutMs },',
    );
  });

  it.each(['knex', 'drizzle', 'typeorm'])('name no such setting on %s, which bounds no transaction in time', (orm) => {
    const root = initProject('--orm', orm);

    expect(read(root, 'src/platform/config/load-config.ts')).not.toContain('DATABASE_TRANSACTION_');
    expect(read(root, '.env.example')).not.toContain('DATABASE_TRANSACTION_');
  });
});
