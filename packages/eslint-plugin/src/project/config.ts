export const CONFIG_FILE = 'ddd-ts-kit.config.json';

export type Severity = 'error' | 'warn' | 'off';

interface Upstream {
  readonly context: string;
  readonly relationship: string;
}

interface ContextConfig {
  readonly classification: string;
  readonly upstreams: readonly Upstream[];
  readonly extraDirectories: readonly string[];
}

type Style = 'declared' | 'explicit';
type Assembly = 'barrel' | 'discovery';

/** The two stack choices a rule reads; the others only concern the generator. */
interface Stack {
  /** `declared`: each class says what it is with a decorator and there is no module file. A config that does not say is `explicit`. */
  readonly style: Style;
  /** How a declared context reaches the composition root: one generated barrel, or discovery of its role files. */
  readonly assembly: Assembly;
}

interface Limits {
  readonly maxParameters: number;
  readonly maxFunctionLines: number;
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
  readonly stack: Stack;
  /** Names reported by `standard/no-parallel-interface`, over its defaults: the kernel interface to use instead, or `false` to drop a default. */
  readonly standardInterfaces: Readonly<Record<string, string | false>>;
}

const DEFAULT_LIMITS: Limits = { maxParameters: 3, maxFunctionLines: 30 };
const STYLES: readonly Style[] = ['declared', 'explicit'];
const ASSEMBLIES: readonly Assembly[] = ['barrel', 'discovery'];

const KERNEL = ['@ddd-ts-kit/kernel'];
/** The application layer declares its permissions and policies with `@ddd-ts-kit/auth`, which imports the kernel only. */
const APPLICATION = [...KERNEL, '@ddd-ts-kit/auth'];

const SCHEMA_LIBRARIES: Readonly<Record<string, readonly string[]>> = {
  zod: ['zod'],
  'class-validator': ['class-validator', 'class-transformer'],
  'standard-schema': [],
  none: [],
};

/**
 * Mirrors `parseConfig` of the CLI key by key, minus the stack choices that only the
 * generator needs: of `stack`, the style and the assembly are kept. A malformed value falls back to its default: `ddd-ts-kit check` reports it
 * as `config/valid`, a linter run must not stop on it.
 */
export function parseConfig(raw: unknown): Config {
  const source = isRecord(raw) ? raw : {};
  const sourceRoot = posix(text(source['sourceRoot'], 'src'));
  return {
    sourceRoot,
    contextsDir: posix(text(source['contextsDir'], `${sourceRoot}/contexts`)),
    sharedKernelDir: posix(text(source['sharedKernelDir'], `${sourceRoot}/shared-kernel`)),
    platformDir: posix(text(source['platformDir'], `${sourceRoot}/platform`)),
    importAlias: text(source['importAlias'], '@/'),
    contexts: mapEntries(source['contexts'], parseContext),
    rules: mapEntries(source['rules'], String),
    domainAllowedPackages: strings(source['domainAllowedPackages'], KERNEL),
    applicationAllowedPackages: strings(source['applicationAllowedPackages'], APPLICATION),
    publishedLanguageAllowedPackages: strings(source['publishedLanguageAllowedPackages'], contractPackages(source['stack'])),
    limits: parseLimits(source['limits']),
    stack: parseStack(source['stack']),
    standardInterfaces: parseStandardInterfaces(source['standardInterfaces']),
  };
}

export function configuredSeverity(config: Config, ruleId: string): Severity | undefined {
  const configured = config.rules[ruleId];
  return configured === 'error' || configured === 'warn' || configured === 'off' ? configured : undefined;
}

function parseStack(value: unknown): Stack {
  const raw = isRecord(value) ? value : {};
  return { style: oneOf(STYLES, raw['style'], 'explicit'), assembly: oneOf(ASSEMBLIES, raw['assembly'], 'barrel') };
}

function contractPackages(stack: unknown): readonly string[] {
  const validation = isRecord(stack) ? text(stack['validation'], 'zod') : 'zod';
  return [...KERNEL, '@ddd-ts-kit/events', '@ddd-ts-kit/validation', ...(SCHEMA_LIBRARIES[validation] ?? [])];
}

function parseContext(value: unknown): ContextConfig {
  const raw = isRecord(value) ? value : {};
  const upstreams = Array.isArray(raw['upstreams']) ? raw['upstreams'] : [];
  const extra = Array.isArray(raw['extraDirectories']) ? raw['extraDirectories'] : [];
  return {
    classification: text(raw['classification'], ''),
    upstreams: upstreams.map(parseUpstream).filter((upstream) => upstream !== undefined),
    extraDirectories: extra.map(parseExtraDirectory).filter((directory) => directory !== undefined),
  };
}

function parseUpstream(value: unknown): Upstream | undefined {
  if (typeof value === 'string') return { context: value, relationship: 'published-language' };
  if (!isRecord(value) || typeof value['context'] !== 'string') return undefined;
  return { context: value['context'], relationship: text(value['relationship'], 'published-language') };
}

function parseExtraDirectory(value: unknown): string | undefined {
  if (typeof value === 'string') return posix(value);
  if (isRecord(value) && typeof value['path'] === 'string') return posix(value['path']);
  return undefined;
}

function parseStandardInterfaces(value: unknown): Record<string, string | false> {
  const entries = Object.entries(isRecord(value) ? value : {}).flatMap(([name, instead]): [string, string | false][] => (instead === false || (typeof instead === 'string' && instead !== '') ? [[name, instead]] : []));
  return Object.fromEntries(entries);
}

function parseLimits(value: unknown): Limits {
  const raw = isRecord(value) ? value : {};
  return {
    maxParameters: positive(raw['maxParameters'], DEFAULT_LIMITS.maxParameters),
    maxFunctionLines: positive(raw['maxFunctionLines'], DEFAULT_LIMITS.maxFunctionLines),
  };
}

function positive(candidate: unknown, fallback: number): number {
  return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0 ? candidate : fallback;
}

function mapEntries<T>(value: unknown, parse: (entry: unknown) => T): Record<string, T> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, parse(entry)])) : {};
}

function strings(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : fallback;
}

function oneOf<T extends string>(values: readonly T[], candidate: unknown, fallback: T): T {
  return values.find((value) => value === candidate) ?? fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function posix(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
