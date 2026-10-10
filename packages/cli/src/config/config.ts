import type { CommitLimits } from './commit-limits.js';
import type { Coverage } from './coverage.js';
import type { Stack } from './stack.js';

export interface Upstream {
  readonly context: string;
  readonly relationship: string;
}

export interface ContextConfig {
  readonly classification: string;
  readonly upstreams: readonly Upstream[];
  readonly extraDirectories: readonly string[];
  /** True once the context has its own entry point under `apps/<context>/main.ts`. */
  readonly deployable: boolean;
}

/** A recorded departure from the defaults: what it relaxes, the decision record that allows it, and why. */
export interface Deviation {
  readonly what: string;
  readonly adr: string;
  readonly reason: string;
}

export interface Limits {
  readonly maxParameters: number;
  /** At most `FUNCTION_LINES_CEILING`: a higher value is read as the ceiling. */
  readonly maxFunctionLines: number;
}

/** A file whose exports are one thing although `clean/one-export-per-file` counts several, and why. */
export interface OnePerFileAllowance {
  readonly file: string;
  readonly reason: string;
}

export interface OnePerFile {
  readonly allow: readonly OnePerFileAllowance[];
}

export interface Config {
  readonly sourceRoot: string;
  readonly contextsDir: string;
  readonly sharedKernelDir: string;
  readonly platformDir: string;
  readonly importAlias: string;
  readonly stack: Stack;
  readonly contexts: Readonly<Record<string, ContextConfig>>;
  readonly rules: Readonly<Record<string, string>>;
  readonly domainAllowedPackages: readonly string[];
  readonly applicationAllowedPackages: readonly string[];
  readonly publishedLanguageAllowedPackages: readonly string[];
  readonly limits: Limits;
  readonly onePerFile: OnePerFile;
  /** The minimum test coverage of each layer, per context: read by the test runner config, lowered only by a recorded deviation. */
  readonly coverage: Coverage;
  /** The advised size of one commit, generated files not counted. */
  readonly commit: CommitLimits;
  /** How the editor hook of the plugin reacts to a violation: `enforce`, `advise` or `off`. Kept as written, `check` reports a wrong value. */
  readonly guard: string;
  readonly deviations: readonly Deviation[];
  /** Names reported by `standard/no-parallel-interface`, over its defaults: the kernel interface to use instead, or `false` to drop a default. */
  readonly standardInterfaces: Readonly<Record<string, string | false>>;
  /** True once the project has a worker process under `apps/worker/main.ts`: the API then starts with its jobs off. */
  readonly worker: boolean;
}
