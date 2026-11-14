import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { settleSameEntities } from '../src/generate/kinds/same-name/settle-same-entities';
import { settleSameNames } from '../src/generate/kinds/same-name/settle-same-names';
import { tableNamesSettled } from '../src/merge/table-names-settled';
import { Workspace } from '../src/workspace';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';
import { CONTEXTS, INDEX } from './support/same-name-project';

/** A workspace whose reading fails where a case says: what the kit cannot foresee in a project. */
class FailingWorkspace extends Workspace {
  private reads = 0;

  constructor(
    root: string,
    private readonly fails: (file: string, reads: number) => boolean,
  ) {
    super(root, false);
  }

  override read(asked: string): string | undefined {
    this.reads += 1;

    if (this.fails(asked, this.reads)) {
      throw new Error(`cannot read ${asked}`);
    }

    return super.read(asked);
  }
}

/** A project of an ORM whose contexts billing and shipping each store Order. */
function twoOrders(orm: string): string {
  const root = initProject('--orm', orm, ...CONTEXTS);

  for (const context of ['billing', 'shipping']) {
    expectOk(cli(root, 'generate', 'aggregate', context, 'Order', '--term', `Order=What ${context} keeps`));
    expectOk(cli(root, 'generate', 'repository', context, 'Order'));
  }

  return root;
}

/** A workspace in which the tables file of billing gains a table as soon as the index is written: a file edited under the command. */
class ChangingWorkspace extends Workspace {
  private written = false;

  override update(asked: string, content: string): void {
    this.written = true;
    super.update(asked, content);
  }

  override read(asked: string): string | undefined {
    const held = super.read(asked);

    return this.written && asked.endsWith('billing.schema.ts') ? `${held ?? ''}\nexport const jobs = 1;\n` : held;
  }
}

describe('an error while the names of the schema index are settled', () => {
  it('puts the index back and says so when what it wrote leaves a table under no name', () => {
    const root = twoOrders('drizzle');
    const unsettled = read(root, INDEX).replace(/^export \{.*\n/gm, '');

    write(root, INDEX, unsettled);

    const ws = new ChangingWorkspace(root, false);
    const said = settleSameNames(ws, readConfig(root).config, { newcomers: ['shipping'] });

    expect(said).toEqual([expect.stringContaining('what it was about to write would leave under no name')]);
    expect(said[0]).toContain('billing.schema.ts#jobs');
    expect(ws.read(INDEX)).toBe(unsettled);
  });

  it('writes nothing on Drizzle and says why, the command going on', () => {
    const root = twoOrders('drizzle');
    const ws = new FailingWorkspace(root, (file) => file.endsWith('billing.schema.ts'));
    const said = settleSameNames(ws, readConfig(root).config, { newcomers: ['shipping'] });

    expect(said).toEqual([
      expect.stringContaining(`${INDEX}: the kit wrote no name in it: reading it and its tables files failed`),
    ]);

    expect(said[0]).toContain('cannot read src/contexts/billing/infrastructure/persistence/billing.schema.ts');
    expect(ws.read(INDEX)).toBe(read(root, INDEX));
  });

  it('rewrites no import on TypeORM and says why, the command going on', () => {
    const root = twoOrders('typeorm');

    // Two imports of one name in the region: something to settle.
    write(
      root,
      INDEX,
      read(root, INDEX).replace('orders as shippingOrders', 'orders').replace('  shippingOrders,\n', ''),
    );

    let indexReads = 0;

    // The second read of the index, once the settle started: the first tells it there is something to settle.
    const ws = new FailingWorkspace(root, (file) => file === INDEX && ++indexReads === 2);
    const said = settleSameEntities(ws, readConfig(root).config);

    expect(said).toEqual([expect.stringContaining(`${INDEX}: the kit rewrote no import of it: reading it failed`)]);
    expect(ws.read(INDEX)).toBe(read(root, INDEX));
  });

  it('settles nothing, and says nothing, in a project whose index is gone', () => {
    const root = twoOrders('typeorm');

    fs.rmSync(path.join(root, INDEX));

    expect(settleSameEntities(new Workspace(root, false), readConfig(root).config)).toEqual([]);
  });

  it('leaves on TypeORM an entity imported under a second name whose entry is not in the region the kit writes', () => {
    const root = twoOrders('typeorm');
    const billing = "'@/contexts/billing/infrastructure/persistence/billing.schema';";

    write(
      root,
      INDEX,
      `import { orders as again } from ${billing}\n${read(root, INDEX).replace('  // ddd-ts-kit:schemas\n', '  again,\n  // ddd-ts-kit:schemas\n')}`,
    );

    const before = read(root, INDEX);
    const ws = new Workspace(root, false);

    expect(settleSameEntities(ws, readConfig(root).config)).toEqual([]);
    expect(ws.read(INDEX)).toBe(before);
  });
});

describe('what a TypeORM settle leaves, held to every entity once', () => {
  it('puts a merged TypeORM index back, and tells the merge nothing it lost, when settling its imports would list an entity no more', () => {
    const root = twoOrders('typeorm');
    const billing = "'@/contexts/billing/infrastructure/persistence/billing.schema';";

    write(
      root,
      INDEX,
      read(root, INDEX)
        .replace('// /ddd-ts-kit:imports\n', `import { orders as again } from ${billing}\n// /ddd-ts-kit:imports\n`)
        .replace('  // /ddd-ts-kit:schemas\n', '  again,\n  // /ddd-ts-kit:schemas\n'),
    );

    const before = read(root, INDEX);
    const ws = new DroppingWorkspace(root);
    const dropped: string[] = [];

    const sides = {
      onTrunk: () => undefined,
      onBranch: () => undefined,
      dropped: (line: string) => dropped.push(line),
    };

    const said = tableNamesSettled(ws, readConfig(root).config, sides);

    // The check of what the settle leaves puts it back first: the entity it touched would be listed no more.
    expect(said).toEqual([expect.stringContaining(`${INDEX}: the kit put the index back as it stood`)]);

    expect(said[0]).toContain(
      "the entity `orders` of 'src/contexts/billing/infrastructure/persistence/billing.schema.ts' imported once and listed 0 times",
    );

    expect(ws.read(INDEX)).toBe(before);
    expect(dropped).toEqual([]);
  });

  it('puts a merged TypeORM index back when an entity is within reach no more once the settle wrote it, whatever the index holds', () => {
    const root = twoOrders('typeorm');

    write(
      root,
      INDEX,
      read(root, INDEX).replace('orders as shippingOrders', 'orders').replace('  shippingOrders,\n', ''),
    );

    const before = read(root, INDEX);
    const ws = new VanishingWorkspace(root, false);
    const sides = { onTrunk: () => undefined, onBranch: () => undefined, dropped: () => undefined };
    const said = tableNamesSettled(ws, readConfig(root).config, sides);

    expect(said).toEqual([expect.stringContaining(`${INDEX} is left as the merge wrote it`)]);
    expect(ws.read(INDEX)).toBe(before);
  });

  it('puts a TypeORM index back when what the settle wrote would list an entity twice', () => {
    const root = twoOrders('typeorm');

    write(
      root,
      INDEX,
      read(root, INDEX).replace('orders as shippingOrders', 'orders').replace('  shippingOrders,\n', ''),
    );

    const before = read(root, INDEX);
    const ws = new DoublingWorkspace(root, false);
    const said = settleSameEntities(ws, readConfig(root).config);

    expect(said).toEqual([
      `${INDEX}: the kit put the index back as it stood: what it wrote would leave \`shippingOrders\` listed twice in \`entities\`; give each entity one import under its own name, and list each name once, by hand.`,
    ]);

    expect(ws.read(INDEX)).toBe(before);
  });
});

/** A workspace that writes the entry of an alias twice: a settle that would list one entity twice. */
class DoublingWorkspace extends Workspace {
  override update(asked: string, content: string): void {
    super.update(
      asked,
      asked === INDEX ? content.replace('  shippingOrders,\n', '  shippingOrders,\n  shippingOrders,\n') : content,
    );
  }
}

/** A workspace that loses the entry of `orders` from the first index it is given: a settle that would take the entity out. */
class DroppingWorkspace extends Workspace {
  private dropped = false;

  constructor(root: string) {
    super(root, false);
  }

  override update(asked: string, content: string): void {
    const drops = asked === INDEX && !this.dropped;

    this.dropped ||= drops;
    super.update(asked, drops ? content.replace(/^[ \t]*orders,\n/m, '') : content);
  }
}

/** A workspace in which the table of billing is gone from its file as soon as the index is written: a file edited under the command. */
class VanishingWorkspace extends Workspace {
  private written = false;

  override update(asked: string, content: string): void {
    this.written = true;
    super.update(asked, content);
  }

  override read(asked: string): string | undefined {
    const held = super.read(asked);

    return this.written && asked.endsWith('billing.schema.ts')
      ? held?.replace('export const orders', 'export const ordersGone')
      : held;
  }
}
