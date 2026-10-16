import type { Slice } from '../progress/slice.js';

/**
 * The rows a plan orders, in the order of the file: those not done, of the context when one is
 * asked for, and the rows not done they wait for, transitively, whatever their context.
 */
export function rowsToPlan(rows: readonly Slice[], context: string | null): Slice[] {
  const open = rows.filter((row) => row.status !== 'done');
  const kept = new Set(open.filter((row) => context === null || row.context === context));
  const queue = [...kept];

  while (queue.length > 0) {
    const waits = queue.shift()?.dependsOn ?? [];
    const found = open.filter((row) => waits.includes(row.id) && !kept.has(row));

    for (const row of found) {
      kept.add(row);
      queue.push(row);
    }
  }

  return open.filter((row) => kept.has(row));
}
