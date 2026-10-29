/**
 * JSON as a command prints it on stdout under `--json` (and `--format json`): on one line, without
 * indentation, for a reader that parses it, the same keys as ever. A file the CLI writes is laid
 * out by `formatJson`, as the formatter of the project would.
 */
export function stdoutJson(value: unknown): string {
  return JSON.stringify(value);
}
