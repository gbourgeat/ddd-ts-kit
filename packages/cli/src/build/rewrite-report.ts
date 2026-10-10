/** What `build-aliases` did under the output directory. */
export interface RewriteReport {
  /** Relative to the project root. */
  readonly outDir: string;
  /** Emitted JavaScript and declaration files read. */
  readonly files: number;
  /** Those that held an alias specifier. */
  readonly changed: number;
  readonly specifiers: number;
}
