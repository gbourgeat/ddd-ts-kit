/**
 * Each cycle of a directed graph, once, as the nodes met from its first one: `next` answers the
 * nodes one node points to.
 */
export function cyclesIn(nodes: readonly string[], next: (node: string) => readonly string[]): string[][] {
  const cycles = new Map<string, string[]>();
  const done = new Set<string>();

  const visit = (node: string, trail: readonly string[]): void => {
    const at = trail.indexOf(node);

    if (at !== -1) {
      const cycle = trail.slice(at);
      const key = [...cycle].sort().join('|');

      if (!cycles.has(key)) {
        cycles.set(key, cycle);
      }

      return;
    }

    if (done.has(node)) {
      return;
    }

    for (const target of next(node)) {
      visit(target, [...trail, node]);
    }

    done.add(node);
  };

  for (const node of nodes) {
    visit(node, []);
  }

  return [...cycles.values()];
}
