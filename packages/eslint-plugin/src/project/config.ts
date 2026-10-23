export type Severity = 'error' | 'warn' | 'off';

/** A severity for some files only, as `ddd-ts-kit check` reads it: the other files keep the severity of the project. */
interface FileRuleSetting {
  readonly severity: string;
  /** Globs relative to the project root. */
  readonly files: readonly string[];
}

/** What `rules.<id>` holds: a severity for the whole project, or one for some files. */
export type RuleSetting = string | FileRuleSetting;

export interface Upstream {
  readonly context: string;
  readonly relationship: string;
}

export interface ContextConfig {
  readonly classification: string;
  readonly upstreams: readonly Upstream[];
  readonly extraDirectories: readonly string[];
  /** The names of the modules of the model of the context, `contexts.<name>.modules`: each one folder of the context holding its layers. */
  readonly modules: readonly string[];
}

export type Style = 'declared' | 'explicit';

export type Assembly = 'barrel' | 'discovery';

/** The stack choices a rule reads; the others only concern the generator. */
export interface Stack {
  /** `declared`: each class says what it is with a decorator and there is no module file. A config that does not say is `explicit`. */
  readonly style: Style;
  /** How a declared context reaches the composition root: one generated barrel, or discovery of its role files. */
  readonly assembly: Assembly;
  /** Where a declared class states what it depends on: its constructor signature, or the list of its decorator. A config that does not say is `listed`. */
  readonly dependencies: 'signature' | 'listed';
  /** How a domain error is written: static factories on one class per concept, or a class per error. A config that does not say is `classes`. */
  readonly refusals: 'named' | 'factories' | 'classes';
  /** How the schemas of the HTTP contract are written: a shape declared once and shared, or one per route. A config that does not say is `per-route`. */
  readonly schemas: 'shared' | 'per-route';
  /** `named`: a value of a declared vocabulary and a number of the model are read through a name. A config that does not say is `free`, and both rules are silent. */
  readonly literals: 'named' | 'free';
  /** `classes`: a value of the model is a value object class, never a function that builds a plain object. A config that does not say is `free`, and `domain/value-object-class` is silent. */
  readonly values: 'classes' | 'free';
  /** Kept as written: with `prisma` the generated client under `generated/` has an import alias of its own. */
  readonly orm: string;
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

/** The generic words `naming/business-name` reports: `words` replaces its list, `allow` removes some of them. */
export interface BusinessNames {
  /** Undefined: the default list of the rule. */
  readonly words: readonly string[] | undefined;
  readonly allow: readonly string[];
}

export interface Config {
  readonly sourceRoot: string;
  readonly contextsDir: string;
  readonly sharedKernelDir: string;
  readonly platformDir: string;
  readonly importAlias: string;
  /** `none` or `js`: whether an import of a file of the project ends with the extension of the emitted file. */
  readonly importExtension: string;
  readonly contexts: Readonly<Record<string, ContextConfig>>;
  readonly rules: Readonly<Record<string, RuleSetting>>;
  readonly domainAllowedPackages: readonly string[];
  readonly applicationAllowedPackages: readonly string[];
  readonly publishedLanguageAllowedPackages: readonly string[];
  readonly limits: Limits;
  /** Files exempt from the count of `clean/one-export-per-file`, never from its file name check. */
  readonly onePerFile: OnePerFile;
  readonly stack: Stack;
  /** Names reported by `standard/no-parallel-interface`, over its defaults: the kernel interface to use instead, or `false` to drop a default. */
  readonly standardInterfaces: Readonly<Record<string, string | false>>;
  /** The words of `naming/business-name`, over its defaults, as the checker reads them. */
  readonly businessNames: BusinessNames;
  /** The clients generated from the contract (`ddd-ts-kit sdk`), whose sources under `clients/` are not linted; none without the key. */
  readonly sdk: SdkConfig | undefined;
}

/** Of the clients of the contract, the plugin reads that they are asked for and their package name. */
export interface SdkConfig {
  readonly name: string;
}
