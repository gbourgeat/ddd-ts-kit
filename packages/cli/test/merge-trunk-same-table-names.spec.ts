import { describe, expect, it } from 'vitest';
import { warnDroppedContextTables } from '../src/migration';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { committedProject } from './support/committed-project';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { CONTEXTS, INDEX, regionOf, sourceOf } from './support/same-name-project';
import { mergeTrunk, onBranch } from './support/trunk-history';

/** The aggregate Order of a context with its repository, committed on the branch of the context, cut from the base. */
function storeOrderOnItsBranch(root: string, context: string): void {
  onBranch(root, `build/${context}`, 'base');
  expectOk(cli(root, 'generate', 'aggregate', context, 'Order', '--term', `Order=What ${context} keeps`));
  expectOk(cli(root, 'generate', 'repository', context, 'Order'));
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', `feat(${context}): store orders`);
}

/**
 * Two branches cut from one base, each of which stored Order in its context: billing landed on the
 * trunk, and the branch of shipping, checked out, is about to merge the trunk.
 */
function twoBranchesOn(orm: string): string {
  const root = committedProject(`same-names-${orm}`, ...CONTEXTS, '--package-manager', 'npm', '--orm', orm);
  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(root, 'commit', '--quiet', '--all', '--message', 'chore: scripts');
  git(root, 'branch', 'base');
  storeOrderOnItsBranch(root, 'billing');
  storeOrderOnItsBranch(root, 'shipping');
  onBranch(root, 'main');
  git(root, 'merge', '--quiet', '--no-edit', 'build/billing');
  onBranch(root, 'build/shipping');

  return root;
}

describe('merge-trunk, when the trunk and the branch each stored a table of one name', () => {
  it('settles the name on Drizzle after keeping the lines of both sides, and says so', () => {
    const root = twoBranchesOn('drizzle');
    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain(`${INDEX}  lists the name \`orders\` of shipping as \`shippingOrders\``);
    expect(merged.stdout).toContain('committed');

    expect(regionOf(root, 'schemas')).toEqual([
      `export * from '${sourceOf('shipping')}';`,
      `export * from '${sourceOf('billing')}';`,
      `export { orders } from '${sourceOf('billing')}';`,
      `export { orders as shippingOrders } from '${sourceOf('shipping')}';`,
    ]);

    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  });

  it('settles the name on TypeORM after keeping the lines of both sides, and says so', () => {
    const root = twoBranchesOn('typeorm');
    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain(`${INDEX}  imported two entities under the name \`orders\``);
    expect(merged.stdout).toContain('committed');

    expect(regionOf(root, 'imports')).toEqual([
      `import { orders } from '${sourceOf('billing')}';`,
      `import { orders as shippingOrders } from '${sourceOf('shipping')}';`,
    ]);

    expect(merged.stdout).toContain('`orders` of shipping is now imported as `shippingOrders`');

    expect(regionOf(root, 'schemas')).toEqual(['orders,', 'shippingOrders,']);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  });

  it('leaves the index of a project on Knex as the merge wrote it', () => {
    const root = twoBranchesOn('knex');

    expect(mergeTrunk(root, '--json').json()).toMatchObject({ status: 'committed' });

    expect(regionOf(root, 'schemas')).toEqual([
      'await createShippingTables(knex);',
      'await createBillingTables(knex);',
    ]);
  });
});

describe('drizzle-generate, on an index that re-exports two tables of one name and settles neither', () => {
  it('warns that the migration drops them: neither is listed', () => {
    const root = twoBranchesOn('drizzle');
    const lines: string[] = [];

    expectOk(mergeTrunk(root));

    write(
      root,
      INDEX,
      read(root, INDEX)
        .split('\n')
        .filter((line) => !line.startsWith('export {'))
        .join('\n'),
    );

    write(root, 'migrations/meta/_journal.json', JSON.stringify({ entries: [{ tag: '0000_init' }] }));

    write(
      root,
      'migrations/meta/0000_snapshot.json',
      JSON.stringify({ tables: { 'billing.orders': {}, 'shipping.orders': {} } }),
    );

    warnDroppedContextTables(root, { out: () => undefined, err: (text) => lines.push(text) });

    expect(lines.join('\n')).toContain('drops the tables of the context billing (billing.orders)');
    expect(lines.join('\n')).toContain('drops the tables of the context shipping (shipping.orders)');

    commitAll(root);
    expectOk(cli(root, 'init', '--force'));
    lines.length = 0;
    warnDroppedContextTables(root, { out: () => undefined, err: (text) => lines.push(text) });

    expect(lines).toEqual([]);
  });
});
