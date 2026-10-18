/** What `ddd-ts-kit lint` asks of the process that runs ESLint, in its environment. */
export interface LintRun {
  readonly root: string;
  readonly patterns: readonly string[];
  readonly format: string;
  readonly fix: boolean;
}
