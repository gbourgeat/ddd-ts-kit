/** The `code` of a Node error of the file system, such as `ENOENT`; undefined for anything else. */
export function errorCodeOf(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}
