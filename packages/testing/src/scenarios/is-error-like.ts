/** What a thrown failure is read by: its name, its message and the failure it wraps. */
export interface ErrorLike {
  readonly name: string;
  readonly message: string;
  readonly cause?: unknown;
}

/**
 * An error by its shape, never by `instanceof Error`: Jest runs a spec in a vm context, where an
 * `AssertionError` of `node:assert`, a core module of the outer realm, is not an instance of the
 * `Error` the spec sees. `Error.isError` would say it, from Node 24 on only.
 */
export function isErrorLike(value: unknown): value is ErrorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
