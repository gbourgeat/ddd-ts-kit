import type { CommitLimits } from './commit-limits.js';
import type { Coverage } from './coverage.js';
import type { RuleSetting } from './rule-setting.js';
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

/** The generic words `naming/business-name` reports: `words` replaces its list, `allow` removes some of them. */
export interface BusinessNames {
  /** Undefined: the default list of the rule. */
  readonly words: readonly string[] | undefined;
  readonly allow: readonly string[];
}

/** What the pipeline adds over the free gates: the jobs of `CI_EXTRAS` the team asked for. */
export interface CiConfig {
  readonly extras: readonly string[];
}

/** One document of the contract: the routes of the route groups, contexts and tags it names (any of them). */
export interface OpenApiDocumentConfig {
  /** The file name, `openapi/<name>.yaml`, and the name the documentation page shows. */
  readonly name: string;
  readonly title?: string;
  /** Route groups by class name; a route belongs to its group and to every group above it. */
  readonly groups: readonly string[];
  readonly contexts: readonly string[];
  readonly tags: readonly string[];
}

/** How the HTTP contract is written: the format of every generated contract, and its split into documents. */
export interface OpenApiConfig {
  /** `yaml` (the default) or `json`, for the OpenAPI and the AsyncAPI documents. Kept as written, `check` reports a wrong value. */
  readonly format: string;
  /** None: one document, `openapi/openapi.yaml`, with every route. */
  readonly documents: readonly OpenApiDocumentConfig[];
}

export interface Config {
  /** The version of the CLI whose `init` wrote the files of the platform, rewritten by `init --force`; none in a project initialised before the key existed. */
  readonly initVersion: string | undefined;
  readonly sourceRoot: string;
  readonly contextsDir: string;
  readonly sharedKernelDir: string;
  readonly platformDir: string;
  readonly importAlias: string;
  /** `none` or `js`: whether an import of a file of the project ends with the extension of the emitted file. Kept as written, `check` reports a wrong value. */
  readonly importExtension: string;
  readonly stack: Stack;
  readonly contexts: Readonly<Record<string, ContextConfig>>;
  readonly rules: Readonly<Record<string, RuleSetting>>;
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
  /**
   * Where the guard of the plugin lets a session write the code of a context: `required`, only in a
   * worktree (the main checkout of the trunk refuses it), as `init` writes a new project; or
   * `advised`, anywhere with a notice, when the key is absent (a project started before). Kept as
   * written, `check` reports a wrong value.
   */
  readonly worktrees: string;
  readonly deviations: readonly Deviation[];
  /** Names reported by `standard/no-parallel-interface`, over its defaults: the kernel interface to use instead, or `false` to drop a default. */
  readonly standardInterfaces: Readonly<Record<string, string | false>>;
  /** The generic words `naming/business-name` reports, over its defaults. */
  readonly businessNames: BusinessNames;
  /** True once the project has a worker process under `apps/worker/main.ts`: the API then starts with its jobs off. */
  readonly worker: boolean;
  readonly ci: CiConfig;
  readonly openapi: OpenApiConfig;
  /** The typed clients generated from the contract (`ddd-ts-kit sdk`); none without the key. */
  readonly sdk: SdkConfig | undefined;
}

/** How the clients of the contract are published: one package per document of the contract, under `clients/<document>`. */
export interface SdkConfig {
  /** The package name, `{project}` the name of the project and `{document}` the document (`api` for the whole contract). */
  readonly name: string;
  /** `public` or `restricted`, written to `publishConfig.access`; none: npm decides (scoped packages are restricted). Kept as written, `check` reports a wrong value. */
  readonly access: string | undefined;
}
