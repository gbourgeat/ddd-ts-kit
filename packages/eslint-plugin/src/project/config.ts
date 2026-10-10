export type Severity = 'error' | 'warn' | 'off';

export interface Upstream {
  readonly context: string;
  readonly relationship: string;
}

export interface ContextConfig {
  readonly classification: string;
  readonly upstreams: readonly Upstream[];
  readonly extraDirectories: readonly string[];
}

export type Style = 'declared' | 'explicit';

export type Assembly = 'barrel' | 'discovery';

/** The two stack choices a rule reads; the others only concern the generator. */
export interface Stack {
  /** `declared`: each class says what it is with a decorator and there is no module file. A config that does not say is `explicit`. */
  readonly style: Style;
  /** How a declared context reaches the composition root: one generated barrel, or discovery of its role files. */
  readonly assembly: Assembly;
}

export interface Limits {
  readonly maxParameters: number;
  readonly maxFunctionLines: number;
}

/** A file whose several exports are one thing, with the sentence that says why. */
export interface AllowedFile {
  /** Path or glob relative to the project root: `*` stays inside one segment, `**` crosses them. */
  readonly file: string;
  readonly reason: string;
}

export interface OnePerFile {
  readonly allow: readonly AllowedFile[];
}

export interface Config {
  readonly sourceRoot: string;
  readonly contextsDir: string;
  readonly sharedKernelDir: string;
  readonly platformDir: string;
  readonly importAlias: string;
  readonly contexts: Readonly<Record<string, ContextConfig>>;
  readonly rules: Readonly<Record<string, string>>;
  readonly domainAllowedPackages: readonly string[];
  readonly applicationAllowedPackages: readonly string[];
  readonly publishedLanguageAllowedPackages: readonly string[];
  readonly limits: Limits;
  /** Files exempt from the count of `clean/one-export-per-file`, never from its file name check. */
  readonly onePerFile: OnePerFile;
  readonly stack: Stack;
  /** Names reported by `standard/no-parallel-interface`, over its defaults: the kernel interface to use instead, or `false` to drop a default. */
  readonly standardInterfaces: Readonly<Record<string, string | false>>;
}
