import type { Slice } from '../progress/slice.js';

/**
 * The cycles of `Depends on` among the rows, each as the ids it goes through, the first one
 * repeated at the end: `['2', '3', '2']` when #2 depends on #3, which depends on #2. A
 * dependency outside the rows is not followed.
 */
export function cyclesOf(rows: readonly Slice[]): string[][] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const state = new Map<string, 'open' | 'closed'>();
  const cycles: string[][] = [];

  const visit = (id: string, chain: readonly string[]): void => {
    const path = [...chain, id];

    state.set(id, 'open');

    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      if (state.get(dependency) === 'open') {
        cycles.push([...path.slice(path.indexOf(dependency)), dependency]);
      } else if (!state.has(dependency) && byId.has(dependency)) {
        visit(dependency, path);
      }
    }

    state.set(id, 'closed');
  };

  for (const row of rows) {
    if (!state.has(row.id)) {
      visit(row.id, []);
    }
  }

  return cycles;
}
