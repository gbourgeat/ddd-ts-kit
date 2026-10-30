/**
 * The candidate closest to `name` by edit distance, when that distance stays within a third of the
 * longer of the two (two edits at least): "contextDir" finds "contextsDir", "ormm" finds "orm",
 * "flavour" finds nothing among the keys of the config.
 */
export function nearestOf(name: string, candidates: readonly string[]): string | undefined {
  const [nearest] = candidates
    .map((candidate) => ({ candidate, distance: editDistance(name.toLowerCase(), candidate.toLowerCase()) }))
    .sort((one, other) => one.distance - other.distance);

  return nearest !== undefined && nearest.distance <= tolerance(name, nearest.candidate)
    ? nearest.candidate
    : undefined;
}

function tolerance(name: string, candidate: string): number {
  return Math.max(2, Math.floor(Math.max(name.length, candidate.length) / 3));
}

/** The Levenshtein distance, row by row: row i holds the cost of turning the first i letters of `a` into each prefix of `b`. */
function editDistance(a: string, b: string): number {
  const firstRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  const lastRow = Array.from(a).reduce((row, letter, index) => nextRow(row, { letter, index: index + 1 }, b), firstRow);

  return lastRow.at(-1) ?? 0;
}

/** The next row of the table, for the letter of `a` at `index` (1-based) against every letter of `b`. */
function nextRow(
  previous: readonly number[],
  { letter, index }: { letter: string; index: number },
  b: string,
): number[] {
  return Array.from(b).reduce<number[]>(
    (row, other, j) => {
      const substitution = (previous[j] ?? 0) + (letter === other ? 0 : 1);
      const deletion = (previous[j + 1] ?? 0) + 1;
      const insertion = (row[j] ?? 0) + 1;

      return [...row, Math.min(substitution, deletion, insertion)];
    },
    [index],
  );
}
