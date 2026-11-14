import { describe, expect, it } from 'vitest';
import { read, write } from './helpers';
import { asMainLeavesIt } from './support/as-main-leaves-it';
import { INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { notWritten } from './support/not-written';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const SHIPPING = "'@/contexts/shipping/infrastructure/persistence/shipping.schema'";

function appended(project: string, line: string): void {
  write(project, INDEX, `${read(project, INDEX)}${line}\n`);
}

describe('merge-trunk on TypeORM, a line of the index a team wrote reads the name two imports give', () => {
  it.each([
    { side: 'branch', line: 'export const legacyBranch = [orders];' },
    { side: 'trunk', line: 'export const legacyTrunk = [orders];' },
  ])('in the $side: nothing is written for any entity, and the merge quotes the line', async ({ side, line }) => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => {
        store(project, 'billing', 'Order');

        if (side === 'trunk') {
          appended(project, line);
        }
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');

        if (side === 'branch') {
          appended(project, line);
        }
      },
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.stdout).toContain(notWritten(read(root, INDEX), line));
    expect(merged.stdout.match(/the kit wrote nothing for the entities/g)).toHaveLength(1);
    expect(merged.stdout).not.toContain('is now imported as `shippingOrders`');
    expect(read(root, INDEX)).toContain(`import { orders } from ${SHIPPING};`);
    // As main leaves it: two imports of one name, which does not compile; never a line reading another entity without a word.
    expect(read(root, INDEX)).toBe(main);
    expect(loaded.error).toMatch(/already been declared/);
  });
});

describe('merge-trunk on Drizzle, a line of the index a team wrote reads a name it imports', () => {
  it('keeps reading the table it imports: the settle writes lines by name, and rebinds no import', () => {
    const root = twoSides({
      orm: 'drizzle',
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');

        write(
          project,
          INDEX,
          `import { orders as shippedOrders } from ${SHIPPING};\n${read(project, INDEX)}export const legacyBranch = [shippedOrders];\n`,
        );
      },
    });

    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);
    expect(read(root, INDEX)).toContain(`import { orders as shippedOrders } from ${SHIPPING};`);
    expect(read(root, INDEX)).toContain('export const legacyBranch = [shippedOrders];');
    expect(merged.stdout).not.toMatch(/shippedOrders/);
  });
});
