import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendAuditGuard, auditGuardStatementsOf, schemasFirst, typeOnlyImports } from '../src/migration';
import { guardedText } from '../src/migration/audit-guard/guarded-text';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';
import { tempDir } from './helpers';

const GUARD = [
  'create or replace function "audit"."audit_entries_append_only"() returns trigger as $g$ begin end $g$',
  'create trigger "audit_entries_no_rewrite" before update on "audit"."audit_entries"',
];

const DRIZZLE =
  'CREATE SCHEMA "audit";\n--> statement-breakpoint\nCREATE TABLE "audit"."audit_entries" (\n\t"id" text\n);\n';

const PRISMA =
  '-- CreateSchema\nCREATE SCHEMA IF NOT EXISTS "audit";\n\n-- CreateTable\nCREATE TABLE "audit"."audit_entries" (\n    "id" TEXT NOT NULL\n);\n';

const TYPEORM = `import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1761400000000 implements MigrationInterface {
    name = 'Init1761400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(\`CREATE TABLE "audit"."audit_entries" ("id" character varying NOT NULL)\`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(\`DROP TABLE "audit"."audit_entries"\`);
    }

}
`;

describe('the audit guard of a generated migration', () => {
  it('follows the creation of the audit entries in the dialect of drizzle-kit, statement after statement', () => {
    expect(guarded('drizzle', 'migrations/0000_init.sql', DRIZZLE)).toBe(
      `${DRIZZLE.trimEnd()}\n--> statement-breakpoint\n${GUARD[0]};\n--> statement-breakpoint\n${GUARD[1]};\n`,
    );
  });

  it('follows the creation of the audit entries in the migration.sql of Prisma', () => {
    expect(guarded('prisma', 'prisma/migrations/20261025_init/migration.sql', PRISMA)).toContain(
      `"id" TEXT NOT NULL\n);\n\n-- The audit trail is append-only: @ddd-ts-kit/audit refuses to rewrite it.\n${GUARD[0]};\n\n${GUARD[1]};\n`,
    );
  });

  it('ends the up of a TypeORM migration with one query per statement, the down left as it was', () => {
    const written = guarded('typeorm', 'migrations/1761400000000-init.ts', TYPEORM);

    expect(written).toContain(
      '("id" character varying NOT NULL)`);\n        await queryRunner.query(`create or replace function "audit"."audit_entries_append_only"() returns trigger as $g$ begin end $g$`);\n        await queryRunner.query(`create trigger',
    );

    expect(written.slice(written.indexOf('public async down('))).toBe(
      TYPEORM.slice(TYPEORM.indexOf('public async down(')),
    );
  });

  it('leaves a project whose migrations hold the guard already, and a migration that creates no audit table', () => {
    const guardedBefore = `${DRIZZLE}--> statement-breakpoint\n${GUARD[0]};\n`;

    expect(guarded('drizzle', 'migrations/0000_init.sql', guardedBefore)).toBe(guardedBefore);

    expect(guarded('drizzle', 'migrations/0001_invoices.sql', 'CREATE TABLE "billing"."invoices" ("id" text);\n')).toBe(
      'CREATE TABLE "billing"."invoices" ("id" text);\n',
    );
  });
});

describe('a run that writes no migration', () => {
  it('guards the migration that creates the audit entries when none of the project holds the guard yet', () => {
    const root = tempDir('audit-guard-rerun');
    const file = 'migrations/0000_init.sql';

    fs.mkdirSync(path.join(root, 'migrations'));
    fs.writeFileSync(path.join(root, file), DRIZZLE);

    fs.writeFileSync(
      path.join(root, 'migrations/0001_invoices.sql'),
      'CREATE TABLE "billing"."invoices" ("id" text);\n',
    );

    appendAuditGuard(
      { root, orm: 'drizzle', written: [], migrations: [file, 'migrations/0001_invoices.sql'] },
      (schema) => GUARD.map((statement) => statement.replaceAll('"audit"', `"${schema}"`)),
      { out: () => undefined, err: () => undefined },
    );

    expect(fs.readFileSync(path.join(root, file), 'utf8')).toBe(
      `${DRIZZLE.trimEnd()}\n--> statement-breakpoint\n${GUARD[0]};\n--> statement-breakpoint\n${GUARD[1]};\n`,
    );
  });
});

describe('a migration TypeORM writes', () => {
  it('imports its types as types, which verbatimModuleSyntax asks of the build that compiles it', () => {
    expect(typeOnlyImports(TYPEORM).split('\n')[0]).toBe(
      "import type { MigrationInterface, QueryRunner } from 'typeorm';",
    );
  });

  it('creates the schemas of its tables first, which TypeORM never does, and is left alone without an up or a table', () => {
    const first = schemasFirst(
      TYPEORM.replace('"audit"."audit_entries" ("id"', '"billing"."invoices" ("id"').replace(
        'DROP TABLE "audit"."audit_entries"',
        'DROP TABLE "billing"."invoices"',
      ),
    );

    expect(first).toContain(
      'public async up(queryRunner: QueryRunner): Promise<void> {\n        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "billing"`);\n        await queryRunner.query(`CREATE TABLE "billing"."invoices"',
    );

    expect(schemasFirst('export class Nothing {}\n')).toBe('export class Nothing {}\n');
  });

  it('cannot add the guard to a TypeORM migration without an up and a down, and says so', () => {
    expect(() => guardedText('typeorm', 'export class Init {}\n', GUARD)).toThrow(
      'The migration holds no `up` and `down` methods to add the audit guard to.',
    );
  });

  it('refuses to read the statements of the guard where @ddd-ts-kit/audit is not installed, naming the install', () => {
    const root = tempDir('audit-guard');

    expect(() => auditGuardStatementsOf(root, 'drizzle')('billing')).toThrow(
      'The statements of the audit guard could not be read from @ddd-ts-kit/audit/drizzle.',
    );
  });

  it('is compiled by the build of a TypeORM project into dist/migrations, where its data source reads it', () => {
    expect(stringsAt(readJson(initProject('--orm', 'typeorm'), 'tsconfig.json'), 'include')).toContain('migrations');
    expect(stringsAt(readJson(initProject('--orm', 'knex'), 'tsconfig.json'), 'include')).not.toContain('migrations');
  });
});

/** The migration once appendAuditGuard ran on a project that holds it alone, the statements read for its schema. */
function guarded(orm: 'drizzle' | 'prisma' | 'typeorm', file: string, content: string): string {
  const root = tempDir('audit-guard');
  const out: string[] = [];

  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);

  appendAuditGuard(
    { root, orm, written: [file], migrations: [file] },
    (schema) => GUARD.map((statement) => statement.replaceAll('"audit"', `"${schema}"`)),
    { out: (text) => out.push(text), err: () => undefined },
  );

  return fs.readFileSync(path.join(root, file), 'utf8');
}
