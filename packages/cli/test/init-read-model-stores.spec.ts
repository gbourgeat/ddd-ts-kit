import { rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { git as inRepository } from './support/git';
import { PERSISTENCE, billingProject, withInvoiceSummaries } from './support/read-model-project';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const LIST = 'database/read-model-tables.ts';

/** The class of the store `generate read-model` writes on each ORM, and its file. */
const STORES = [
  ['drizzle', 'DrizzleInvoiceSummaries', 'drizzle-invoice-summaries'],
  ['knex', 'KnexInvoiceSummaries', 'knex-invoice-summaries'],
  ['prisma', 'PrismaInvoiceSummaries', 'prisma-invoice-summaries'],
  ['typeorm', 'TypeOrmInvoiceSummaries', 'type-orm-invoice-summaries'],
] as const;

describe('init: the read model stores of the tree join the list of the tables', () => {
  it('fills the list from the stores the tree holds, with init and init --force, where a project has none or an empty one', () => {
    for (const [orm, store, file] of STORES) {
      for (const flags of [[], ['--force']]) {
        const root = billingProject('--orm', orm);

        withInvoiceSummaries(root);
        rmSync(path.join(root, 'src/platform', LIST));
        expectOk(cli(root, 'init', ...flags));

        const tables = platform(root, LIST);

        expect(tables).toContain(
          `import { ${store} } from '@/contexts/billing/infrastructure/persistence/${file}.repository';`,
        );

        expect(tables).toContain(`  ['billing', ${store}],\n  // /ddd-ts-kit:read-model-tables`);
        expect(tables).toContain('  // ddd-ts-kit:read-models-not-listed\n  // /ddd-ts-kit:read-models-not-listed');
      }
    }
  });

  it('names a store it cannot build among those not listed, and says what to write, once', () => {
    const root = billingProject('--orm', 'knex', '--tenancy', 'shared-table');
    const store = 'src/contexts/billing/infrastructure/persistence/knex-invoice-summaries.repository.ts';

    withInvoiceSummaries(root);

    write(
      root,
      store,
      read(root, store).replace('scope: ExecutionScope)', 'scope: ExecutionScope, readonly page = 20)'),
    );

    rmSync(path.join(root, 'src/platform', LIST));

    const first = cli(root, 'init', '--force');

    expectOk(first);

    expect(first.stdout).toContain(
      'KnexInvoiceSummaries (src/contexts/billing/infrastructure/persistence/knex-invoice-summaries.repository.ts) is a read model store this command cannot list with certainty',
    );

    expect(platform(root, LIST)).toContain(
      "  // ddd-ts-kit:read-models-not-listed\n  'billing: KnexInvoiceSummaries',\n",
    );

    expect(platform(root, LIST)).not.toContain("['billing', KnexInvoiceSummaries]");
    expect(cli(root, 'init', '--force').stdout).not.toContain('cannot list with certainty');
    expect(platform(root, LIST).match(/'billing: KnexInvoiceSummaries',/g)).toHaveLength(1);
  });
});

describe('the list of the read model tables: the contexts an entry may name, and a name two contexts share', () => {
  it('names the contexts of the project in the list, so that an entry under another name does not compile', () => {
    const root = billingProject('--orm', 'knex');

    expectOk(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting'));

    expect(platform(root, LIST)).toContain(
      "type Contexts = [\n  // ddd-ts-kit:contexts\n  'billing',\n  'shipping',\n  // /ddd-ts-kit:contexts\n];",
    );

    expectOk(cli(root, 'init', '--force'));

    expect(platform(root, LIST).match(/^ {2}'(billing|shipping)',$/gm)).toEqual(["  'billing',", "  'shipping',"]);
  });

  it('lists a store of the same name in a second context under an alias, from the generator and from init', () => {
    const root = billingProject('--orm', 'knex');

    const second =
      "import { KnexInvoiceSummaries as ShippingKnexInvoiceSummaries } from '@/contexts/shipping/infrastructure/persistence/knex-invoice-summaries.repository';";

    expectOk(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting'));
    withInvoiceSummaries(root);
    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries', '--field', 'weight:number'));

    for (const rebuilt of [false, true]) {
      if (rebuilt) {
        rmSync(path.join(root, 'src/platform', LIST));
        expectOk(cli(root, 'init', '--force'));
      }

      const tables = platform(root, LIST);

      expect(tables).toContain(
        "import { KnexInvoiceSummaries } from '@/contexts/billing/infrastructure/persistence/knex-invoice-summaries.repository';",
      );

      expect(tables).toContain(second);
      expect(tables).toContain("  ['billing', KnexInvoiceSummaries],\n  ['shipping', ShippingKnexInvoiceSummaries],\n");
    }

    expectOk(cli(root, 'init', '--force'));

    expect(platform(root, LIST).match(/KnexInvoiceSummaries\],/g)).toHaveLength(2);
  });
});

describe('init: the stores it cannot list with certainty, and those left out on purpose', () => {
  it('finds every store of a file and of a base class of the project, and names those it cannot list with certainty', () => {
    const root = billingProject('--orm', 'knex');
    const store = `${PERSISTENCE}/knex-invoice-summaries.repository.ts`;

    withInvoiceSummaries(root);

    // A base class of the project, a second store in the same file whose constructor is its own, a
    // store that inherits its constructor, a generic one, and a class that is no store before them.
    write(
      root,
      store,
      `${read(root, store)}
class Paging {
  constructor(readonly size: number, readonly page: number) {}
}

export abstract class BillingStore extends KnexInvoiceSummaries {}

export class KnexLateInvoices extends BillingStore {
  constructor(database: KnexContext) {
    super(database);
  }
}

export class KnexInherited extends BillingStore {}

export class KnexAny<Row extends object> extends KnexReadModelStore<Row> {
  constructor(database: KnexContext, readonly paging: Paging) {
    super(database, { table: 'any', columns: {}, definition: invoiceSummariesCriteria });
  }
}
`,
    );

    rmSync(path.join(root, 'src/platform', LIST));

    const forced = expectOk(cli(root, 'init', '--force'));
    const tables = platform(root, LIST);

    expect(tables).toContain("  ['billing', KnexInvoiceSummaries],\n  ['billing', KnexLateInvoices],\n");
    expect(tables).toContain("  'billing: KnexInherited',\n  'billing: KnexAny',\n");
    expect(tables).not.toMatch(/BillingStore|Paging/);
    expect(forced.stdout).toContain('KnexInherited (');
    expect(forced.stdout).toContain('KnexAny (');
  });

  it('leaves out a store the list names in a comment, on purpose, with its reason', () => {
    const root = billingProject('--orm', 'knex');

    withInvoiceSummaries(root);

    write(
      root,
      `src/platform/${LIST}`,
      platform(root, LIST)
        .replace(/^import \{ KnexInvoiceSummaries \}.*\n/m, '')
        .replace(
          "  ['billing', KnexInvoiceSummaries],",
          '  // billing: KnexInvoiceSummaries, left out: rebuilt each night',
        ),
    );

    for (const step of [
      ['init', '--quiet', '--initial-branch', 'main'],
      ['add', '--all'],
      ['commit', '--quiet', '-m', 'chore: left out'],
    ]) {
      inRepository(root, ...step);
    }

    expectOk(cli(root, 'init', '--force'));

    expect(platform(root, LIST)).toContain('  // billing: KnexInvoiceSummaries, left out: rebuilt each night');
    expect(platform(root, LIST)).not.toContain("['billing', KnexInvoiceSummaries]");
    expect(platform(root, LIST)).not.toContain("'billing: KnexInvoiceSummaries',");
  });
});

describe('init and the rule of the checker read the same stores', () => {
  it('agrees with persistence/read-model-listed: what init lists passes, a store built by a class beside it is answered for, an entry removed is reported', () => {
    const root = billingProject('--orm', 'knex');
    const store = `${PERSISTENCE}/knex-invoice-summaries.repository.ts`;
    const listed = `${PERSISTENCE}/listed-knex-any.repository.ts`;
    const judged = (): ReturnType<typeof cli> => cli(root, 'check', '--rule', 'persistence/read-model-listed');

    withInvoiceSummaries(root);

    write(
      root,
      `${PERSISTENCE}/knex-any.repository.ts`,
      "import { KnexReadModelStore, type KnexContext } from '@ddd-ts-kit/knex';\n\nexport class KnexAny<Row extends object> extends KnexReadModelStore<Row> {\n  constructor(database: KnexContext, readonly size: number) {\n    super(database, { table: 'any', columns: {}, definition: { fields: {}, tieBreaker: 'id' } as never });\n  }\n}\n",
    );

    expect(judged().stdout).toContain(
      'KnexAny is a read model store of billing that src/platform/database/read-model-tables.ts neither lists',
    );

    expect(judged().stdout).toContain("add `'billing: KnexAny',` to NOT_LISTED");
    expectOk(cli(root, 'init'));
    expect(platform(root, LIST)).toContain("  'billing: KnexAny',\n");
    expect(judged().code).toBe(0);

    write(
      root,
      listed,
      "import type { KnexContext } from '@ddd-ts-kit/knex';\nimport { KnexAny } from '@/contexts/billing/infrastructure/persistence/knex-any.repository';\n\nexport class ListedKnexAny extends KnexAny<object> {\n  constructor(database: KnexContext) {\n    super(database, 20);\n  }\n}\n",
    );

    write(root, `src/platform/${LIST}`, platform(root, LIST).replace("  'billing: KnexAny',\n", ''));

    const again = expectOk(cli(root, 'init'));

    expect(again.stdout).not.toContain('cannot list with certainty');
    expect(platform(root, LIST)).toContain("  ['billing', ListedKnexAny],\n");
    expect(platform(root, LIST)).not.toContain("'billing: KnexAny'");
    expect(judged().code).toBe(0);

    write(root, `src/platform/${LIST}`, platform(root, LIST).replace("  ['billing', KnexInvoiceSummaries],\n", ''));

    const reported = judged();

    expect(reported.code).not.toBe(0);
    expect(reported.stdout).toContain(`${store}:`);

    // The import is still there: the entry alone is to add, under the name the list already gives the class.
    expect(reported.stdout).toContain(
      "add `['billing', KnexInvoiceSummaries],` to LISTED (`ddd-ts-kit init` writes it)",
    );

    expect(reported.stdout).not.toContain('BillingKnexInvoiceSummaries');
    expectOk(cli(root, 'init'));
    expect(platform(root, LIST).match(/import \{ KnexInvoiceSummaries \}/g)).toHaveLength(1);
    expect(platform(root, LIST)).toContain("  ['billing', KnexInvoiceSummaries],\n");
    expect(judged().code).toBe(0);

    rmSync(path.join(root, 'src/platform', LIST));

    expect(judged().stdout).toContain(
      'the project holds read model stores and no src/platform/database/read-model-tables.ts',
    );

    expect(judged().stdout).toContain('ddd-ts-kit init --force');
  });
});
