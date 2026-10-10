/**
 * One write into the copy: `to` replaces `from`, which the file has to hold; with `where` it is
 * added at that end of the file; with neither it is the whole file, new or not.
 */
export interface Change {
  readonly file: string;
  readonly from?: string;
  readonly where?: 'start' | 'end';
  readonly to: string;
}

/** A finding the injection cannot avoid next to the one it proves, and why. */
export interface Companion {
  readonly tool: 'checker' | 'eslint';
  readonly rule: string;
  readonly reason: string;
}

/**
 * A minimal violation of one rule of the catalogue, written into the copy of the example. The
 * tools that own the rule report it on `file`, and report nothing else but the declared companions.
 */
export interface Injection {
  /** The id of the catalogue (`ddd-ts-kit rules`). */
  readonly rule: string;
  readonly what: string;
  /** The file the finding lands on. */
  readonly file: string;
  readonly changes: readonly Change[];
  readonly removes?: readonly string[];
  /** True when `ddd-ts-kit check` holds the rule. */
  readonly checker: boolean;
  /** The name ESLint reports the rule under, when ESLint holds it. */
  readonly eslint?: string;
  /** True when the formatter holds the rule. */
  readonly formatter?: boolean;
  readonly alsoReports?: readonly Companion[];
}
