import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { CONTEXTS, INDEX, regionOf, sourceOf, tablesOf } from './support/same-name-project';
import { mergeTrunk, onBranch } from './support/trunk-history';

/** An aggregate of a context with its repository. */
function store(root: string, context: string, aggregate: string): void {
  expectOk(cli(root, 'generate', 'aggregate', context, aggregate, '--term', `${aggregate}=What ${context} keeps`));
  expectOk(cli(root, 'generate', 'repository', context, aggregate));
}

/** What each side of a merge stores, each on its branch cut from the same base. */
interface Sides {
  readonly base?: (root: string) => void;
  readonly trunk: (root: string) => void;
  readonly branch: (root: string) => void;
}

/**
 * A Drizzle project in the folder `app` of a repository: `base` committed, then the trunk and the
 * branch `build/shipping` each with what its side stores, the branch checked out before the merge.
 */
function twoSides({ base = () => undefined, trunk, branch }: Sides): string {
  const top = fs.realpathSync(tempDir('trunk-keeps'));
  const root = path.join(top, 'app');

  const commit = (message: string): void => {
    git(top, 'add', '--all');
    git(top, 'commit', '--quiet', '--message', message);
  };

  expectOk(cli(root, 'init', ...CONTEXTS, '--package-manager', 'npm', '--orm', 'drizzle'));

  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(top, 'init', '--quiet', '--initial-branch', 'main');
  base(root);
  commit('chore: base');
  git(top, 'branch', 'base');
  onBranch(top, 'build/shipping', 'base');
  branch(root);
  commit('feat(shipping): store');
  onBranch(top, 'main');
  trunk(root);
  commit('feat: what landed on the trunk');
  onBranch(top, 'build/shipping');

  return root;
}

describe('merge-trunk, on a name the trunk already exports from the schema index', () => {
  it('gives the name back to the table of the trunk when the branch had settled it between its own contexts', () => {
    const root = twoSides({
      trunk: (project) => store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        store(project, 'returns', 'Order');
      },
    });

    expect(regionOf(root, 'schemas')).toContain(`export { orders } from '${sourceOf('shipping')}';`);

    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain(
      `app/${INDEX}  lists the name \`orders\` of shipping as \`shippingOrders\`, no longer as \`orders\``,
    );

    expect(merged.stdout).not.toContain(`\n  ${INDEX}  `);
    expect(merged.stdout).toContain('committed');

    expect(regionOf(root, 'schemas').filter((line) => line.startsWith('export {'))).toEqual([
      `export { orders as shippingOrders } from '${sourceOf('shipping')}';`,
      `export { orders as returnsOrders } from '${sourceOf('returns')}';`,
      `export { orders } from '${sourceOf('billing')}';`,
    ]);
  });

  it('leaves to the table of the trunk the name the branch had taken for its own', () => {
    const root = twoSides({
      base: (project) => store(project, 'billing', 'Order'),
      trunk: (project) => store(project, 'returns', 'ShippingOrder'),
      branch: (project) => store(project, 'shipping', 'Order'),
    });

    expect(regionOf(root, 'schemas')).toContain(`export { orders as shippingOrders } from '${sourceOf('shipping')}';`);

    expect(mergeTrunk(root).stdout).toContain('committed');

    expect(regionOf(root, 'schemas').filter((line) => line.startsWith('export {'))).toEqual([
      `export { orders } from '${sourceOf('billing')}';`,
      `export { orders as shippingContextOrders } from '${sourceOf('shipping')}';`,
    ]);
  });

  it('leaves as they are the names the trunk had settled, and gives the table of the branch its own', () => {
    const root = twoSides({
      base: (project) => {
        store(project, 'billing', 'Order');
        store(project, 'returns', 'Order');
      },
      trunk: (project) => store(project, 'billing', 'Invoice'),
      branch: (project) => store(project, 'shipping', 'Order'),
    });

    expect(mergeTrunk(root).stdout).toContain('committed');

    expect(regionOf(root, 'schemas').filter((line) => line.startsWith('export {'))).toEqual([
      `export { orders } from '${sourceOf('billing')}';`,
      `export { orders as returnsOrders } from '${sourceOf('returns')}';`,
      `export { orders as shippingOrders } from '${sourceOf('shipping')}';`,
    ]);
  });

  it('says nothing of the names in a dry run whose configuration the merge leaves conflicted', () => {
    const context = (name: string) => (project: string) => {
      expectOk(cli(project, 'generate', 'context', name, '--classification', 'supporting'));
      store(project, name, 'Order');
    };

    const root = twoSides({ trunk: context('couriers'), branch: context('carriers') });
    const previewed = mergeTrunk(root, '--dry-run');

    expect(previewed.stdout).toContain('dry run: nothing changed');
    expect(previewed.stdout).toContain('ddd-ts-kit.config.json');
    expect(previewed.stdout).not.toContain('lists the name');
  });

  it('calls out a name that names another table after the merge, whatever moved it', () => {
    const root = twoSides({
      trunk: (project) => store(project, 'billing', 'Order'),
      branch: (project) => store(project, 'shipping', 'Order'),
    });

    expect(mergeTrunk(root).stdout).toContain(
      `\`orders\`, which the index of the branch exported as \`orders\` of '${tablesOf('shipping')}', now names \`orders\` of '${tablesOf('billing')}'`,
    );
  });

  it('goes on to its commit, the index as the merge wrote it, when settling the names fails', () => {
    const root = twoSides({
      trunk: (project) => {
        store(project, 'billing', 'Order');
        write(project, 'ddd-ts-kit.config.json', '{ "contexts": ');
      },
      branch: (project) => store(project, 'shipping', 'Order'),
    });

    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain('the kit wrote no name in it: settling them failed');
    expect(merged.stdout).toContain('committed');
    expect(read(root, INDEX)).not.toMatch(/^export \{/m);
  });
});

describe('merge-trunk, on what it says of the names of the schema index', () => {
  it('says in a dry run what the merge would settle, and changes nothing', () => {
    const root = twoSides({
      trunk: (project) => store(project, 'billing', 'Order'),
      branch: (project) => store(project, 'shipping', 'Order'),
    });

    const before = read(root, INDEX);
    const previewed = mergeTrunk(root, '--dry-run');

    expect(previewed.stdout).toContain('dry run: nothing changed');
    expect(previewed.stdout).toContain(`app/${INDEX}  lists the name \`orders\` of shipping as \`shippingOrders\``);
    expect(read(root, INDEX)).toBe(before);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  });

  it('reads in a dry run the files the merge itself reads: a tables file that re-exports a folder of its own, a module of the platform', () => {
    const persistence = 'src/contexts/billing/infrastructure/persistence';

    const root = twoSides({
      trunk: (project) => {
        store(project, 'billing', 'Order');
        write(project, `${persistence}/tables/index.ts`, read(project, `${persistence}/billing.schema.ts`));
        write(project, `${persistence}/billing.schema.ts`, "export * from './tables';\n");
        write(project, 'src/platform/extra.ts', 'export const extra = 1;\n');

        write(
          project,
          INDEX,
          read(project, INDEX).replace(
            '// /ddd-ts-kit:schemas',
            "export * from '@/platform/extra';\n// /ddd-ts-kit:schemas",
          ),
        );
      },
      branch: (project) => store(project, 'shipping', 'Parcel'),
    });

    const previewed = mergeTrunk(root, '--dry-run');
    const merged = mergeTrunk(root);

    expect(previewed.stdout).toContain('dry run: nothing changed');
    expect(previewed.stdout).not.toContain('the kit wrote no name in it');
    expect(merged.stdout).not.toContain('the kit wrote no name in it');
  });

  it('says in a dry run, as the merge does, the name a tables file re-exported from a folder of its own shares', () => {
    const persistence = 'src/contexts/billing/infrastructure/persistence';

    const root = twoSides({
      trunk: (project) => {
        store(project, 'billing', 'Order');

        write(
          project,
          `${persistence}/tables/index.ts`,
          read(project, `${persistence}/billing.schema.ts`).replaceAll("'./", "'../"),
        );

        write(project, `${persistence}/billing.schema.ts`, "export * from './tables';\n");
      },
      branch: (project) => store(project, 'shipping', 'Order'),
    });

    const settled = `app/${INDEX}  lists the name \`orders\` of shipping as \`shippingOrders\``;

    expect(mergeTrunk(root, '--dry-run').stdout).toContain(settled);
    expect(mergeTrunk(root).stdout).toContain(settled);
  });

  it('writes nothing when a name the trunk exports would name something else, the index of the branch declaring it', () => {
    const root = twoSides({
      trunk: (project) => store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Parcel');
        write(project, INDEX, `${read(project, INDEX)}\nexport const orders = 1;\n`);
      },
    });

    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain('it did not find how to keep the names the trunk exports (orders)');
    expect(read(root, INDEX)).not.toContain('billingOrders');
  });

  it('says nothing of a name of the trunk whose table the branch took away', () => {
    const tables = 'src/contexts/billing/infrastructure/persistence/billing.schema.ts';

    const root = twoSides({
      base: (project) => {
        store(project, 'billing', 'Order');
        store(project, 'shipping', 'Order');
      },
      trunk: (project) => store(project, 'shipping', 'Invoice'),
      branch: (project) => {
        write(project, tables, read(project, tables).replace(/export const orders = [\s\S]*?\n\}\);\n/, ''));
        write(project, INDEX, read(project, INDEX).replace(/^export \{ orders.*\n/gm, ''));
        store(project, 'returns', 'Order');
      },
    });

    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);
    expect(merged.stdout).not.toContain('did not find how to keep');
    expect(merged.stdout).not.toContain('the kit wrote no name in it');
  });
});
