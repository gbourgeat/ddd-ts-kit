/** A duration of the config: a whole number of milliseconds above zero. */
export function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
