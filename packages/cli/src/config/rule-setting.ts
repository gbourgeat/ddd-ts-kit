/** A severity for some files only: a finding placed on another file keeps the severity of the project. */
interface FileRuleSetting {
  readonly severity: string;
  /** Globs relative to the project root: `*` inside one path segment, `**` across segments. */
  readonly files: readonly string[];
}

/** What `rules.<id>` holds: a severity for the whole project, or one for some files. Kept as written, `check` reports a wrong value. */
export type RuleSetting = string | FileRuleSetting;
