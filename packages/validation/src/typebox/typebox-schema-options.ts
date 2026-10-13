export interface TypeboxSchemaOptions {
  /**
   * Converts text to the declared types before checking (`"3"` to `3`, `"true"` to `true`): for
   * path parameters and query strings, which always arrive as text.
   */
  readonly coerce?: boolean;
}
