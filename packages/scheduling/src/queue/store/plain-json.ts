/** A value as it comes back from JSON, the way every store of the queue hands it back: a date becomes its text. */
export function plainJson(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
