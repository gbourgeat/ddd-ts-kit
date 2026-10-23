/** The median of the values, undefined of none. */
export function median(values: readonly number[]): number | undefined {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];

  if (upper === undefined) {
    return undefined;
  }

  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}
