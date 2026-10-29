import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { initProject } from './support/init-project';

const MODULES = path.resolve(__dirname, '../../../node_modules');

/** Slow: it starts the Prisma CLI and PostgreSQL in process; skipped where the monorepo has no Prisma installed. */
const INSTALLED = fs.existsSync(path.join(MODULES, 'prisma/build/index.js'));

describe.runIf(INSTALLED)('db:generate of a Prisma project with no database reachable', () => {
  let url: string | undefined;

  beforeEach(() => {
    url = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
  });

  afterEach(() => {
    if (url !== undefined) {
      process.env['DATABASE_URL'] = url;
    }
  });

  it('writes the migration on PostgreSQL in process, guarded, then finds nothing more to write', () => {
    const root = initProject('--orm', 'prisma', '--audit', 'on', '--package-manager', 'npm');

    fs.symlinkSync(MODULES, path.join(root, 'node_modules'), 'dir');

    const first = cli(root, 'prisma-generate', '--name', 'Init tables');
    const folder = path.join(root, 'prisma/migrations');
    const [migration] = fs.readdirSync(folder).filter((entry) => entry.endsWith('_init_tables'));

    expect(first.stderr).toBe('');
    expect(first.code).toBe(0);
    expect(migration).toBeDefined();

    const sql = fs.readFileSync(path.join(folder, migration ?? '', 'migration.sql'), 'utf8');

    expect(sql).toContain('CREATE TABLE "audit"."audit_entries"');
    expect(sql).toContain('audit_entries_no_rewrite');
    expect(fs.readFileSync(path.join(folder, 'migration_lock.toml'), 'utf8')).toContain('provider = "postgresql"');

    const second = cli(root, 'prisma-generate', '--name', 'again');

    expect(second.code).toBe(0);
    expect(fs.readdirSync(folder).filter((entry) => entry.endsWith('_again'))).toEqual([]);
  }, 180_000);
});

describe('db:generate with a DATABASE_URL or without the ORM installed', () => {
  it('keeps the refusal of a database that cannot be reached when the URL names one', () => {
    const root = initProject('--orm', 'prisma', '--package-manager', 'npm');
    const previous = process.env['DATABASE_URL'];

    process.env['DATABASE_URL'] = 'postgresql://app:app@127.0.0.1:1/app';

    try {
      const result = cli(root, 'prisma-generate', '--name', 'init');

      expect(result.code).toBe(3);
      expect(result.stderr).toContain('cannot be reached');
    } finally {
      if (previous === undefined) {
        delete process.env['DATABASE_URL'];
      } else {
        process.env['DATABASE_URL'] = previous;
      }
    }
  });

  it('says what to install for TypeORM when the project has no node_modules, with no URL either', () => {
    const root = initProject('--orm', 'typeorm', '--package-manager', 'npm');
    const previous = process.env['DATABASE_URL'];

    delete process.env['DATABASE_URL'];

    try {
      const result = cli(root, 'typeorm-generate', 'migrations/init');

      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('typeorm is not installed');
    } finally {
      if (previous !== undefined) {
        process.env['DATABASE_URL'] = previous;
      }
    }
  });
});
