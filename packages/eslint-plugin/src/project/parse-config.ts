import type { Upstream, ContextConfig, Style, Assembly, Stack, Limits, OnePerFile, Config } from './config.js';
import { parseAllowedFile } from './parse-allowed-file.js';
import { posix } from './posix.js';
import { isRecord } from './is-record.js';

const DEFAULT_LIMITS: Limits = { maxParameters: 3, maxFunctionLines: 30 };

/** No function is longer, whatever the config says: `clean/function-size` reads a higher limit as this one. */
export const FUNCTION_LINES_CEILING = 100;

const STYLES: readonly Style[] = ['declared', 'explicit'];

const ASSEMBLIES: readonly Assembly[] = ['barrel', 'discovery'];
const DEPENDENCY_STATEMENTS: readonly Stack['dependencies'][] = ['signature', 'listed'];

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
 * generator needs: of `stack`, the style, the assembly and the ORM are kept. A malformed value falls back to its default: `ddd-ts-kit check` reports it
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
    // A config without the key was written before it existed: its imports end with `.js`.
    importExtension: text(source['importExtension'], 'js'),
    contexts: mapEntries(source['contexts'], parseContext),
    rules: mapEntries(source['rules'], String),
    domainAllowedPackages: strings(source['domainAllowedPackages'], KERNEL),
    applicationAllowedPackages: strings(source['applicationAllowedPackages'], APPLICATION),
    publishedLanguageAllowedPackages: strings(
      source['publishedLanguageAllowedPackages'],
      contractPackages(source['stack']),
    ),
    limits: parseLimits(source['limits']),
    onePerFile: parseOnePerFile(source['onePerFile']),
    stack: parseStack(source['stack']),
    standardInterfaces: parseStandardInterfaces(source['standardInterfaces']),
  };
}

function parseStack(value: unknown): Stack {
  const raw = isRecord(value) ? value : {};

  return {
    style: oneOf(STYLES, raw['style'], 'explicit'),
    assembly: oneOf(ASSEMBLIES, raw['assembly'], 'barrel'),
    dependencies: oneOf(DEPENDENCY_STATEMENTS, raw['dependencies'], 'listed'),
    orm: text(raw['orm'], 'drizzle'),
  };
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
  if (typeof value === 'string') {
    return { context: value, relationship: 'published-language' };
  }

  if (!isRecord(value) || typeof value['context'] !== 'string') {
    return undefined;
  }

  return { context: value['context'], relationship: text(value['relationship'], 'published-language') };
}

function parseExtraDirectory(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return posix(value);
  }

  if (isRecord(value) && typeof value['path'] === 'string') {
    return posix(value['path']);
  }

  return undefined;
}

function parseStandardInterfaces(value: unknown): Record<string, string | false> {
  const entries = Object.entries(isRecord(value) ? value : {}).flatMap(([name, instead]): [string, string | false][] =>
    instead === false || (typeof instead === 'string' && instead !== '') ? [[name, instead]] : [],
  );

  return Object.fromEntries(entries);
}

function parseLimits(value: unknown): Limits {
  const raw = isRecord(value) ? value : {};

  return {
    maxParameters: positive(raw['maxParameters'], DEFAULT_LIMITS.maxParameters),
    maxFunctionLines: Math.min(
      positive(raw['maxFunctionLines'], DEFAULT_LIMITS.maxFunctionLines),
      FUNCTION_LINES_CEILING,
    ),
  };
}

function parseOnePerFile(value: unknown): OnePerFile {
  const allow = isRecord(value) && Array.isArray(value['allow']) ? value['allow'] : [];

  return { allow: allow.flatMap(parseAllowedFile) };
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
