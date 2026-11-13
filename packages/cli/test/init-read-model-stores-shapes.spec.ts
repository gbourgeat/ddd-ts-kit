import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { PERSISTENCE, billingProject, withInvoiceSummaries } from './support/read-model-project';

const LIST = 'src/platform/database/read-model-tables.ts';
const STORE = `${PERSISTENCE}/knex-invoice-summaries.repository.ts`;
const judged = (root: string): ReturnType<typeof cli> => cli(root, 'check', '--rule', 'persistence/read-model-listed');

/** The generated store under another name, in a file of its own, with what a case changes in it. */
function copied(root: string, name: string, change: (source: string) => string = (source) => source): void {
  const kebab = name.replace(/[A-Z]/g, (letter, at: number) => `${at === 0 ? '' : '-'}${letter.toLowerCase()}`);

  write(
    root,
    `${PERSISTENCE}/${kebab}.repository.ts`,
    change(read(root, STORE).replaceAll('KnexInvoiceSummaries', name)),
  );
}

describe('init: the shapes of a store it lists, and those it names with the reason', () => {
  it('lists a store built on a member type with modifiers, and one whose type parameter holds an object type is named', () => {
    const root = billingProject('--orm', 'knex');

    withInvoiceSummaries(root);

    copied(root, 'KnexLateSummaries', (source) =>
      source.replace(/constructor\((\w+): KnexContext\)/, "constructor(private readonly $1: Persistence['database'])"),
    );

    copied(root, 'KnexWideSummaries', (source) =>
      source.replace(
        'class KnexWideSummaries ',
        'class KnexWideSummaries<Kept extends { id: string } = { id: string }> ',
      ),
    );

    expect(read(root, `${PERSISTENCE}/knex-late-summaries.repository.ts`)).toContain("Persistence['database'])");

    const listed = expectOk(cli(root, 'init'));

    expect(read(root, LIST)).toContain("  ['billing', KnexLateSummaries],\n");
    expect(read(root, LIST)).toContain("  'billing: KnexWideSummaries',\n");
    expect(listed.stdout).toContain('cannot list with certainty: the class is generic.');
    expect(read(root, LIST)).not.toContain("'billing: KnexLateSummaries'");
    expect(judged(root).code).toBe(0);
  });

  it('names a store its file exports as its default or does not export, says which, and writes no import of it', () => {
    const root = billingProject('--orm', 'knex');

    withInvoiceSummaries(root);
    copied(root, 'KnexDefaultSummaries', (source) => source.replace('export class', 'export default class'));
    copied(root, 'KnexHiddenSummaries', (source) => source.replace('export class', 'class'));

    const named = expectOk(cli(root, 'init'));

    expect(named.stdout).toContain(
      'KnexDefaultSummaries (src/contexts/billing/infrastructure/persistence/knex-default-summaries.repository.ts) is a read model store this command cannot list with certainty: it is the default export of its file',
    );

    expect(named.stdout).toContain('cannot list with certainty: its file does not export it.');
    expect(named.stdout).toContain("constructor(database: Persistence['database']) { super(..); }");
    expect(read(root, LIST)).toContain("  'billing: KnexDefaultSummaries',\n  'billing: KnexHiddenSummaries',\n");
    expect(read(root, LIST)).not.toMatch(/import .*Knex(?:Default|Hidden)Summaries/);
    expect(judged(root).code).toBe(0);

    // The default import, written by hand, is read as the class its file exports.
    write(
      root,
      LIST,
      read(root, LIST)
        .replace("  'billing: KnexDefaultSummaries',\n", '')
        .replace(
          '// /ddd-ts-kit:imports',
          "import KnexDefaultSummaries from '@/contexts/billing/infrastructure/persistence/knex-default-summaries.repository';\n// /ddd-ts-kit:imports",
        )
        .replace(
          '  // /ddd-ts-kit:read-model-tables',
          "  ['billing', KnexDefaultSummaries],\n  // /ddd-ts-kit:read-model-tables",
        ),
    );

    expect(judged(root).stdout).not.toContain('neither imports nor declares');
    expect(judged(root).code).toBe(0);
    expect(expectOk(cli(root, 'init')).stdout).not.toContain('KnexDefaultSummaries (');
  });
});
