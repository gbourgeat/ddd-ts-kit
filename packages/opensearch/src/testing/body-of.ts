/** A JSON object of a request, a mapping or a query, as the fake reads it. */
export type Body = Readonly<Record<string, unknown>>;

/** The value when it is a JSON object, an empty one otherwise: what the node reads of a part it ignores. */
export function bodyOf(value: unknown): Body {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
}
