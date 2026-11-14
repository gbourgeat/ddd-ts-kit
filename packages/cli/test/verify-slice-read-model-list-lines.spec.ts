import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const LIST = 'src/platform/database/read-model-tables.ts';
const PERSISTENCE = 'infrastructure/persistence';

/**
 * A committed project on Knex whose scripts stand for the real ones: the trunk holds the read
 * models the first function writes, and the branch of a slice of `context` is checked out.
 */
function sliceOf(context: string, onTrunk: (root: string) => void, ...contexts: readonly string[]): string {
  const declared = ['billing:core', 'shipping:supporting', ...contexts].flatMap((name) => ['--context', name]);
  const root = committedProject(`lines-${context}`, ...declared, '--package-manager', 'npm', '--orm', 'knex');
  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  manifest.scripts['test'] = 'node -e ""';
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  onTrunk(root);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'feat: the read models of the trunk');
  git(root, 'switch', '--quiet', '--create', `build/${context}`);

  return root;
}

function readModel(root: string, context: string, name: string): void {
  expectOk(cli(root, 'generate', 'read-model', context, name));
}

function plan(root: string, context: string): { toStage: string[]; leftOut: string[] } {
  const verification = cli(root, 'verify-slice', context, '--since', 'main', '--json').json();

  return {
    toStage: jsonAt(verification, 'toStage') as string[],
    leftOut: jsonAt(verification, 'leftOut') as string[],
  };
}

/** The list with a line added at the end of one of its regions. */
function withLine(root: string, region: string, line: string): void {
  write(root, LIST, read(root, LIST).replace(`  // /ddd-ts-kit:${region}`, `  ${line}\n  // /ddd-ts-kit:${region}`));
}

describe('verify-slice reads each line of the list of the read model tables for what it is', () => {
  it('leaves the list out when it gained the import of the store of the same name of another context', () => {
    const root = sliceOf('shipping', (trunk) => readModel(trunk, 'shipping', 'InvoiceSummaries'));

    readModel(root, 'shipping', 'ParcelsToSend');

    expect(plan(root, 'shipping').toStage).toContain(LIST);

    write(
      root,
      LIST,
      read(root, LIST).replace(
        '// /ddd-ts-kit:imports',
        `import { KnexInvoiceSummaries as BillingKnexInvoiceSummaries } from '@/contexts/billing/${PERSISTENCE}/knex-invoice-summaries.repository';\n// /ddd-ts-kit:imports`,
      ),
    );

    expect(plan(root, 'shipping').leftOut).toContain(LIST);
  });

  it('leaves the list out when it lists a store of the slice under another context', () => {
    const root = sliceOf('shipping', (trunk) => readModel(trunk, 'billing', 'InvoiceSummaries'));

    readModel(root, 'shipping', 'ParcelsToSend');
    withLine(root, 'read-model-tables', "['billing', KnexParcelsToSend],");

    expect(plan(root, 'shipping').leftOut).toContain(LIST);
  });

  it('does not take a package of the kit for the context that bears its name', () => {
    const root = sliceOf('kernel', (trunk) => readModel(trunk, 'billing', 'InvoiceSummaries'), 'kernel:generic');

    readModel(root, 'kernel', 'Settings');

    expect(plan(root, 'kernel').toStage).toContain(LIST);

    write(
      root,
      LIST,
      read(root, LIST).replace(
        '// ddd-ts-kit:imports',
        "import { Result } from '@ddd-ts-kit/kernel';\n// ddd-ts-kit:imports",
      ),
    );

    expect(plan(root, 'kernel').leftOut).toContain(LIST);
  });

  it('stages the list a slice took its own read model away from', () => {
    const root = sliceOf('shipping', (trunk) => readModel(trunk, 'shipping', 'ParcelsToSend'));
    const store = `src/contexts/shipping/${PERSISTENCE}/knex-parcels-to-send.repository.ts`;

    write(
      root,
      LIST,
      read(root, LIST)
        .split('\n')
        .filter((line) => !line.includes('KnexParcelsToSend'))
        .join('\n'),
    );

    fs.rmSync(path.join(root, store));

    expect(plan(root, 'shipping')).toMatchObject({ toStage: expect.arrayContaining([LIST]), leftOut: [] });
  });

  it('leaves the list out while it names a context the committed configuration does not hold', () => {
    const root = sliceOf('couriers', (trunk) => readModel(trunk, 'billing', 'InvoiceSummaries'));

    expectOk(cli(root, 'generate', 'context', 'couriers', '--classification', 'supporting'));
    readModel(root, 'couriers', 'Rounds');

    expect(read(root, LIST)).toContain("  'couriers',\n");
    expect(plan(root, 'couriers').leftOut).toEqual(expect.arrayContaining([LIST, 'ddd-ts-kit.config.json']));
  });

  it('leaves the list out while git holds no configuration to read the context in', () => {
    const root = sliceOf('couriers', (trunk) => {
      readModel(trunk, 'billing', 'InvoiceSummaries');
      write(trunk, '.gitignore', `${read(trunk, '.gitignore')}ddd-ts-kit.config.json\n`);
      git(trunk, 'rm', '--quiet', '--cached', 'ddd-ts-kit.config.json');
    });

    expectOk(cli(root, 'generate', 'context', 'couriers', '--classification', 'supporting'));
    readModel(root, 'couriers', 'Rounds');

    expect(plan(root, 'couriers').leftOut).toContain(LIST);
  });
});
