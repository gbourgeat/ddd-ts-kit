import type { Config, Severity } from '../config.js';
import type { Scan } from './scanner.js';
import type { Structure } from './structure.js';

export interface Violation {
  readonly ruleId: string;
  readonly severity: 'error' | 'warn';
  readonly file: string;
  readonly line: number;
  readonly message: string;
  /** One sentence saying what to do instead; written for whoever has to repair the code. */
  readonly fix: string;
}

export type Layer =
  | 'domain'
  | 'application'
  | 'infrastructure'
  | 'presentation'
  | 'published-language'
  | 'test'
  | 'module'
  | 'root';

export type Location =
  | { readonly area: 'context'; readonly context: string; readonly layer: Layer; readonly inside: readonly string[] }
  | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };

export type ImportTarget =
  | { readonly kind: 'file'; readonly path: string; readonly location: Location }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };

interface ResolvedImport {
  readonly specifier: string;
  readonly line: number;
  readonly names: readonly string[];
  readonly target: ImportTarget;
}

export interface SourceFile {
  /** Posix path relative to the project root. */
  readonly path: string;
  readonly location: Location;
  readonly isTest: boolean;
  readonly text: string;
  readonly scan: Scan;
  readonly imports: readonly ResolvedImport[];
  /** Declarations, read on first use: only the clean/* rules need them. */
  readonly structure: Structure;
}

export interface Project {
  readonly root: string;
  readonly config: Config;
  readonly configText: string;
  /** TypeScript sources under the source root (or the single file of `check-file`). */
  readonly files: readonly SourceFile[];
  /** Every file under the contexts directory, sources or not, relative to the root. */
  readonly contextEntries: readonly string[];
  /** Context directories found on disk. */
  readonly contextsOnDisk: readonly string[];
  severity(ruleId: string): Severity;
  locate(file: string): Location;
}

export interface Rule {
  readonly id: string;
  readonly description: string;
  /** `file` rules need one source at a time and run in `check-file`; `project` rules need the tree. */
  readonly scope: 'file' | 'project';
  run(project: Project): Violation[];
}

export interface RuleDoc {
  readonly why: string;
  readonly bad: string;
  readonly good: string;
}
