import type { Slice } from '../progress/slice';

/**
 * The ids of the rows each row waits for, directly or through the rows it waits for, among
 * `rows`, every row of the file: a row waits for another through rows the plan does not replay
 * too. The row itself is not among them, unless a cycle leads back to it. Each row is walked once.
 */
export function transitiveDependencies(rows: readonly Slice[]): (row: Slice) => ReadonlySet<string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const walked = new Map<string, ReadonlySet<string>>();

  return (row) => {
    const known = walked.get(row.id);

    if (known !== undefined) {
      return known;
    }

    const found = new Set<string>();
    const queue = [...row.dependsOn];

    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (!found.has(id)) {
        found.add(id);
        queue.push(...(byId.get(id)?.dependsOn ?? []));
      }
    }

    walked.set(row.id, found);

    return found;
  };
}
