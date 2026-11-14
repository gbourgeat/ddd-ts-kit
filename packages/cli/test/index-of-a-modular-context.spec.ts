import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { CONTEXTS, INDEX } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const SHARED = '@/contexts/billing/shared/infrastructure/persistence/billing.schema';

/** What a command printed about the names of the index: nothing, in a project where no name is shared. */
function expectNothingSaid(said: string): void {
  expect(said).not.toMatch(
    /lists the name|lists the entity|is left as it stood|the kit wrote no name|imported the entity/,
  );
}

/** The lines of the index that name a module: on Drizzle the `export *` of each tables file alone, on TypeORM each entity imported under its own name. */
function expectIndexAsGenerated(root: string, orm: string): void {
  const index = read(root, INDEX);

  if (orm === 'drizzle') {
    expect(index).not.toMatch(/^export (?:type )?\{/m);
    expect(index.match(new RegExp(`^export \\* from '${SHARED}';$`, 'gm'))).toHaveLength(1);
  } else {
    expect(index).not.toMatch(/^import \{[^}]* as [^}]*\} from '@\/contexts/m);
  }
}

/** A committed project whose context billing stores Order, then is laid out in modules, `invoicing` its first module. */
function modular(orm: string): string {
  const root = initProject('--orm', orm, ...CONTEXTS, '--package-manager', 'npm');
  const run = (...args: string[]): string => expectOk(cli(root, ...args)).stdout;

  commitAll(root);
  run('generate', 'aggregate', 'billing', 'Order', '--term', 'Order=a purchase');
  run('generate', 'repository', 'billing', 'Order');
  commitAll(root);

  run(
    'generate',
    'module',
    'billing',
    'invoicing',
    '--purpose',
    'Bills the orders.',
    '--term',
    'Invoicing=billing the orders',
  );

  run('context-layout', 'billing');
  commitAll(root);

  return root;
}

/** The aggregate Invoice of the module, with its repository: what the repository printed. */
function storeInvoice(root: string): string {
  expectOk(
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--module', 'invoicing', '--term', 'Invoice=a bill'),
  );

  return expectOk(cli(root, 'generate', 'repository', 'billing', 'Invoice', '--module', 'invoicing')).stdout;
}

describe.each(['drizzle', 'typeorm'])(
  'the schema index of a context laid out in modules, on %s, no name shared',
  (orm) => {
    it('is written as by any generation: generate repository and read-model in a module, then init --force', async () => {
      const root = modular(orm);
      const said = [storeInvoice(root)];

      said.push(
        expectOk(
          cli(
            root,
            'generate',
            'read-model',
            'billing',
            'InvoiceSummaries',
            '--module',
            'invoicing',
            '--field',
            'ref:string',
          ),
        ).stdout,
      );

      const dryRun = cli(
        root,
        'generate',
        'read-model',
        'billing',
        'Refunds',
        '--module',
        'invoicing',
        '--dry-run',
        '--json',
      );

      expect(dryRun.code).toBe(0);
      expect(jsonAt(dryRun.json(), 'left')).toBeUndefined();

      commitAll(root);
      said.push(expectOk(cli(root, 'init', '--force')).stdout);

      said.forEach(expectNothingSaid);
      expectIndexAsGenerated(root, orm);

      const loaded = await loadedIndex(root);

      expect({ error: loaded.error, missing: loaded.missing, twice: loaded.twice }).toEqual({
        error: undefined,
        missing: [],
        twice: [],
      });

      expect(loaded.tables).toEqual(
        expect.arrayContaining(['billing.orders', 'billing.invoices', 'billing.invoice_summaries']),
      );
    });

    it('is merged as any index: two branches that each add a table to a module', () => {
      const root = twoSides({
        orm,
        base: (project) => {
          const run = (...args: string[]): void => void expectOk(cli(project, ...args));

          run('generate', 'aggregate', 'billing', 'Order', '--term', 'Order=a purchase');
          run('generate', 'repository', 'billing', 'Order');
          commitAll(project);

          run(
            'generate',
            'module',
            'billing',
            'invoicing',
            '--purpose',
            'Bills the orders.',
            '--term',
            'Invoicing=billing the orders',
          );

          run('context-layout', 'billing');
        },
        trunk: (project) => void storeInvoice(project),
        branch: (project) =>
          void expectOk(
            cli(
              project,
              'generate',
              'read-model',
              'billing',
              'InvoiceSummaries',
              '--module',
              'invoicing',
              '--field',
              'ref:string',
            ),
          ),
      });

      const previewed = mergeTrunk(root, '--dry-run');
      const merged = mergeTrunk(root);

      expect(merged.code, merged.stdout).toBe(0);
      [previewed.stdout, merged.stdout].forEach(expectNothingSaid);
      expectIndexAsGenerated(root, orm);
      // The index names both tables once; the merge of the tables file both sides wrote in is not of this change.
      expect(read(root, INDEX).match(/\binvoices\b/g)?.length).toBe(orm === 'drizzle' ? undefined : 2);
      expect(read(root, INDEX).match(/\binvoiceSummaries\b/g)?.length).toBe(orm === 'drizzle' ? undefined : 2);
    });

    it('is staged with a slice of the module as with any slice', () => {
      const root = modular(orm);

      git(root, 'switch', '--quiet', '--create', 'build/billing');
      storeInvoice(root);

      const plan = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json();
      const changed = git(root, 'status', '--porcelain').includes(INDEX);

      // On Drizzle the `export *` of the tables file stands already: the slice changes nothing in the index.
      expect(changed).toBe(orm === 'typeorm');
      expect(jsonAt(plan, 'leftOut')).not.toContain(INDEX);
      expect((jsonAt(plan, 'toStage') as string[]).includes(INDEX)).toBe(changed);
    });
  },
);

describe('names shared with a context laid out in modules, by commands run in it', () => {
  it('binds each name to its table: the context listed first keeps it, the other gets its own', async () => {
    const root = modular('drizzle');

    expectOk(cli(root, 'generate', 'aggregate', 'shipping', 'Order', '--term', 'Order=a delivery'));
    expectOk(cli(root, 'generate', 'repository', 'shipping', 'Order'));
    storeInvoice(root);
    expectOk(cli(root, 'generate', 'aggregate', 'shipping', 'Invoice', '--term', 'Invoice=a delivery note'));
    expectOk(cli(root, 'generate', 'repository', 'shipping', 'Invoice'));

    expectOk(
      cli(root, 'generate', 'read-model', 'billing', 'Parcels', '--module', 'invoicing', '--field', 'ref:string'),
    );

    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'Parcels', '--field', 'ref:string'));

    const loaded = await loadedIndex(root);

    expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });

    expect(loaded.bound).toMatchObject({
      orders: 'billing.orders',
      shippingOrders: 'shipping.orders',
      invoices: 'billing.invoices',
      shippingInvoices: 'shipping.invoices',
      parcels: 'billing.parcels',
      shippingParcels: 'shipping.parcels',
    });

    expect(read(root, INDEX).match(/^export \{.*$/gm)).toHaveLength(6);
  });
});
