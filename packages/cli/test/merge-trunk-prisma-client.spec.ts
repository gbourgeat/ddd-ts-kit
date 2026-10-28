import { describe, expect, it } from 'vitest';
import { exists, read, write } from './helpers';
import { git } from './support/git';
import { commitFiles, goOn, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';
const SCHEMA = 'prisma/schema/billing.prisma';
const GENERATED = 'generated/schema.sql';

/** `db:client` writes the git-ignored schema of the tests from the Prisma schema, as `prisma migrate diff` does. */
const DB_CLIENT = `node -e "const fs=require('fs');fs.mkdirSync('generated',{recursive:true});fs.writeFileSync('${GENERATED}', fs.readFileSync('${SCHEMA}','utf8'))"`;

function project(orm: string): string {
  return trunkRepository({
    [INVOICE]: 'class Invoice {\n}\n',
    '.gitignore': '.ddd-ts-kit/\nnode_modules/\ngenerated/\n',
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm } }),
    'package.json': JSON.stringify({ name: 'billing', scripts: { regenerate: 'node -e ""', 'db:client': DB_CLIENT } }),
  });
}

/** The branch changes the invoice, the trunk changes it too (a conflict) and `trunk` files. */
function conflicting(root: string, trunk: Record<string, string>): void {
  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
  onBranch(root, 'main');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  cancel() {}\n}\n', ...trunk }, 'feat: cancel (#2)');
  onBranch(root, 'build/billing');

  expect(mergeTrunk(root).code).toBe(1);

  write(root, INVOICE, 'class Invoice {\n  pay() {}\n  cancel() {}\n}\n');
  git(root, 'add', INVOICE);
}

describe('merge-trunk: the client of a Prisma schema the merge changed', () => {
  it('runs db:client on --continue, so that the schema of the tests is current', () => {
    const root = project('prisma');

    conflicting(root, { [SCHEMA]: 'model Invoice {}\n' });

    const done = goOn(root, '--continue', '--json');

    expect(done.json()).toMatchObject({ status: 'committed', client: { status: 'ok' } });
    expect(read(root, GENERATED)).toBe('model Invoice {}\n');
  }, 60_000);

  it('stops, naming the script, while db:client fails', () => {
    const root = project('prisma');

    conflicting(root, { [SCHEMA]: 'model Invoice {}\n' });

    write(
      root,
      'package.json',
      JSON.stringify({
        name: 'billing',
        scripts: { regenerate: 'node -e ""', 'db:client': 'node -e "process.exit(4)"' },
      }),
    );

    git(root, 'add', 'package.json');

    expect(goOn(root, '--continue', '--json').json()).toMatchObject({
      status: 'stopped',
      client: { status: 'failed' },
      stop: '`npm run db:client` failed',
    });
  }, 60_000);

  it('leaves it alone when the merge changed no Prisma schema', () => {
    const root = project('prisma');

    conflicting(root, {});

    expect(goOn(root, '--continue', '--json').json()).toMatchObject({ status: 'committed' });
    expect(exists(root, GENERATED)).toBe(false);
  }, 60_000);

  it('leaves it alone on an ORM that reads tracked sources at runtime', () => {
    const root = project('drizzle');

    conflicting(root, { [SCHEMA]: 'model Invoice {}\n' });

    expect(goOn(root, '--continue', '--json').json()).toMatchObject({ status: 'committed' });
    expect(exists(root, GENERATED)).toBe(false);
  }, 60_000);
});
