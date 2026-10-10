export interface LintHost {
  readonly filename: string;
  readonly cwd: string;
  readonly settings: Readonly<Record<string, unknown>>;
}
