import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

const SINGLE = 'prisma/schema.prisma';
const MAIN = 'prisma/schema/schema.prisma';
const SINGLE_CLIENT = '--to-schema prisma/schema.prisma --script';

const BILLING_MODEL = [
  'model BillingInvoice {',
  '  id      String @id',
  '  version Int',
  '',
  '  @@map("invoices")',
  '  @@schema("billing")',
  '}',
].join('\n');

/**
 * A project on Prisma as 0.94 laid it out: one `prisma/schema.prisma` with the models of every
 * context in its models region, named by `prisma.config.ts` and by the `db:client` script.
 */
function laidOutBy094(): string {
  const root = initProject(
    '--orm',
    'prisma',
    '--package-manager',
    'npm',
    '--audit',
    'off',
    '--context',
    'billing:core',
  );

  const single = read(root, MAIN)
    .replace('"../../generated/prisma"', '"../generated/prisma"')
    .replace('schemas  = ["messaging"]', 'schemas  = ["messaging", "billing"]');

  write(root, SINGLE, `${single.trimEnd()}\n\n// ddd-ts-kit:models\n${BILLING_MODEL}\n// /ddd-ts-kit:models\n`);
  fs.rmSync(path.join(root, 'prisma/schema'), { recursive: true });

  write(
    root,
    'prisma.config.ts',
    read(root, 'prisma.config.ts').replace("'./prisma/schema'", "'./prisma/schema.prisma'"),
  );

  const manifest: Record<string, Record<string, string>> = JSON.parse(read(root, 'package.json'));
  const scripts = manifest['scripts'] ?? {};

  scripts['db:client'] = (scripts['db:client'] ?? '').replace('--to-schema prisma/schema --script', SINGLE_CLIENT);
  write(root, 'package.json', JSON.stringify(manifest, null, 2));

  return root;
}

const scriptOf = (root: string, name: string): unknown => jsonAt(readJson(root, 'package.json'), 'scripts', name);

describe('init run again on a Prisma project laid out by 0.94, one prisma/schema.prisma', () => {
  it('writes nothing under prisma/schema/ and keeps the file, prisma.config.ts and db:client as they are', () => {
    const root = laidOutBy094();
    const before = read(root, SINGLE);

    const report = cli(root, 'init', '--orm', 'prisma', '--package-manager', 'npm', '--audit', 'off', '--json');

    expect(report.code, report.stderr).toBe(0);
    expect(exists(root, 'prisma/schema')).toBe(false);
    expect(read(root, SINGLE)).toBe(before);
    expect(read(root, 'prisma.config.ts')).toContain("schema: './prisma/schema.prisma',");
    expect(String(scriptOf(root, 'db:client'))).toContain(SINGLE_CLIENT);

    const notes = stringsAt(report.json(), 'notes').join('\n');

    expect(notes).toContain('prisma/schema.prisma holds the whole Prisma schema, as versions before 0.95 laid it out');
    expect(notes).toContain('`mkdir prisma/schema && git mv prisma/schema.prisma prisma/schema/schema.prisma`');
    expect(notes).toContain('the models and enums whose `@@schema` is "billing" into prisma/schema/billing.prisma');
    expect(notes).toContain("in prisma.config.ts set `schema: './prisma/schema'`");
    expect(notes).not.toContain('package.json keeps its own "db:client" script');
  });

  it('keeps that layout under --force too: the folder would hold a second datasource beside the first', () => {
    const root = laidOutBy094();

    const forced = cli(root, 'init', '--orm', 'prisma', '--package-manager', 'npm', '--audit', 'off', '--force');

    expect(forced.code, forced.stderr).toBe(0);
    expect(exists(root, 'prisma/schema')).toBe(false);
    expect(read(root, SINGLE)).toContain('model BillingInvoice {');
    expect(read(root, 'prisma.config.ts')).toContain("schema: './prisma/schema.prisma',");
    expect(String(scriptOf(root, 'db:client'))).toContain(SINGLE_CLIENT);
  });

  it('lets the To move of 0.95 run once init ran: the folder it creates is free', () => {
    const root = laidOutBy094();

    cli(root, 'init', '--orm', 'prisma', '--package-manager', 'npm', '--audit', 'off');

    fs.mkdirSync(path.join(root, 'prisma/schema'));
    fs.renameSync(path.join(root, SINGLE), path.join(root, MAIN));

    expect(read(root, MAIN)).toContain('model BillingInvoice {');
  });

  it('refuses generate repository until the schema is moved, with the steps', () => {
    const root = laidOutBy094();

    cli(root, 'generate', 'aggregate', 'billing', 'CreditNote', '--allow-name');

    const refused = cli(root, 'generate', 'repository', 'billing', 'CreditNote', '--allow-name');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('prisma/schema.prisma holds the whole Prisma schema');

    expect(refused.stderr).toContain(
      '`mkdir prisma/schema && git mv prisma/schema.prisma prisma/schema/schema.prisma`',
    );

    expect(exists(root, 'prisma/schema')).toBe(false);
  });

  it('writes the folder on a new project, where no prisma/schema.prisma exists', () => {
    const root = initProject('--orm', 'prisma', '--package-manager', 'npm', '--audit', 'off');

    expect(exists(root, MAIN)).toBe(true);
    expect(exists(root, SINGLE)).toBe(false);
  });
});
