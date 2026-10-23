/** What `ddd-ts-kit lint` asks of the process that runs ESLint, in its environment. */
export interface LintRun {
  readonly root: string;
  readonly patterns: readonly string[];
  readonly format: string;
  readonly fix: boolean;
  /** Where ESLint keeps its cache, a directory the command prepared (`lintCacheOf`); none with `--no-cache`. */
  readonly cache: string | undefined;
}
