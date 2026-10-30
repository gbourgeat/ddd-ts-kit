import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const SCHEMA_INDEX = 'src/platform/database/schema.ts';

/** A committed project of the ORM whose scripts stand for the real ones, on the branch of a billing slice that generated Invoice and its repository. */
function billingSlice(orm: string): string {
  const root = committedProject(
    `verify-slice-${orm}`,
    '--context',
    'billing:core',
    '--context',
    'shipping:supporting',
    '--package-manager',
    'npm',
    '--orm',
    orm,
  );

  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  manifest.scripts['test'] = 'node -e ""';
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(root, 'commit', '--quiet', '--all', '--message', 'chore: scripts');
  git(root, 'switch', '--quiet', '--create', 'build/billing');

  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment'));
  expectOk(cli(root, 'generate', 'repository', 'billing', 'Invoice'));

  return root;
}

function plan(root: string): { toStage: unknown; leftOut: unknown } {
  const verification = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json();

  return { toStage: jsonAt(verification, 'toStage'), leftOut: jsonAt(verification, 'leftOut') };
}

describe('verify-slice counts what the generator wrote for the slice outside its context', () => {
  it('stages the Prisma file of the context and the datasource it joined, and the page of what its tests state', () => {
    const root = billingSlice('prisma');

    write(root, 'docs/behaviour/billing.md', '# billing: what its tests state\n');

    const { toStage, leftOut } = plan(root);

    expect(toStage).toEqual(
      expect.arrayContaining([
        'prisma/schema/billing.prisma',
        'prisma/schema/schema.prisma',
        'docs/behaviour/billing.md',
      ]),
    );

    expect(leftOut).toEqual([]);
  });

  it('leaves the main Prisma file out once it holds more than the context joining the datasource', () => {
    const root = billingSlice('prisma');
    const schema = read(root, 'prisma/schema/schema.prisma');

    write(
      root,
      'prisma/schema/schema.prisma',
      schema.replace('  traceparent   String?\n', '  traceparent   String?\n  tracestate    String?\n'),
    );

    expect(plan(root).leftOut).toEqual(['prisma/schema/schema.prisma']);

    write(
      root,
      'prisma/schema/schema.prisma',
      `${schema}\nmodel BillingLedger {\n  id String @id\n\n  @@schema("billing")\n}\n`,
    );

    expect(plan(root).leftOut).toEqual(['prisma/schema/schema.prisma']);
  });

  it.each(['drizzle', 'knex', 'typeorm'])(
    'stages the schema index of the platform the repository joined on %s',
    (orm) => {
      const root = billingSlice(orm);

      expect(git(root, 'status', '--porcelain')).toContain(SCHEMA_INDEX);
      expect(plan(root)).toEqual({ toStage: expect.arrayContaining([SCHEMA_INDEX]), leftOut: [] });
    },
  );

  it('leaves out the schema index once the slice deleted it: its lines on disk are gone', () => {
    const root = billingSlice('drizzle');

    fs.rmSync(path.join(root, SCHEMA_INDEX));

    expect(plan(root).leftOut).toEqual([SCHEMA_INDEX]);
  });
});
