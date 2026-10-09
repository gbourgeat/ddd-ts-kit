import fs from 'node:fs';
import path from 'node:path';
import { CliError } from './errors.js';

export const CONFIG_FILE = 'ddd-ts-kit.config.json';

export const HTTP_STACKS = ['express', 'fastify', 'nest', 'none'] as const;
export const VALIDATION_STACKS = ['zod', 'class-validator', 'standard-schema', 'none'] as const;
export const DI_STACKS = ['tsyringe', 'nest', 'manual'] as const;
const EVENT_STACKS = ['in-memory', 'outbox', 'custom'] as const;
export const ORM_STACKS = ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none'] as const;
export const DATABASE_STACKS = ['postgres', 'mysql', 'sqlite', 'mongodb', 'none'] as const;
export const TEST_STACKS = ['vitest', 'jest'] as const;
export const DOCS_UIS = ['swagger', 'scalar', 'redoc', 'none'] as const;
export const CI_PLATFORMS = ['github', 'gitlab', 'both', 'none'] as const;
export const AUTHN_STACKS = ['jwt', 'keycloak', 'none'] as const;
export const AUTHZ_STACKS = ['rbac', 'abac', 'rebac', 'custom'] as const;
export const BROKER_STACKS = ['none', 'rabbitmq', 'custom'] as const;
export const CACHE_STACKS = ['none', 'redis'] as const;
export const AUDIT_MODES = ['on', 'off'] as const;
export const GUARD_MODES = ['enforce', 'advise', 'off'] as const;
export const CLASSIFICATIONS = ['core', 'supporting', 'generic'] as const;
export const RELATIONSHIPS = [
  'published-language',
  'customer-supplier',
  'conformist',
  'anti-corruption-layer',
  'open-host-service',
  'shared-kernel',
] as const;
export const SEVERITIES = ['error', 'warn', 'off'] as const;

type HttpStack = (typeof HTTP_STACKS)[number];
type ValidationStack = (typeof VALIDATION_STACKS)[number];
type DiStack = (typeof DI_STACKS)[number];
type EventStack = (typeof EVENT_STACKS)[number];
export type OrmStack = (typeof ORM_STACKS)[number];
type DatabaseStack = (typeof DATABASE_STACKS)[number];
type TestStack = (typeof TEST_STACKS)[number];
type DocsUi = (typeof DOCS_UIS)[number];
type CiPlatform = (typeof CI_PLATFORMS)[number];
type AuthnStack = (typeof AUTHN_STACKS)[number];
type AuthzStack = (typeof AUTHZ_STACKS)[number];
type BrokerStack = (typeof BROKER_STACKS)[number];
type CacheStack = (typeof CACHE_STACKS)[number];
type AuditMode = (typeof AUDIT_MODES)[number];
export type Severity = (typeof SEVERITIES)[number];

export interface Stack {
  readonly http: HttpStack;
  readonly validation: ValidationStack;
  readonly di: DiStack;
  readonly events: EventStack;
  readonly orm: OrmStack;
  readonly database: DatabaseStack;
  readonly tests: TestStack;
  /** The interactive page served next to the OpenAPI contract. */
  readonly docsUi: DocsUi;
  /** The platform whose pipeline files `init` installed. */
  readonly ci: CiPlatform;
  /** How the caller is identified at the boundary. */
  readonly authn: AuthnStack;
  /** The authorization model behind the `Authorizer` port. */
  readonly authz: AuthzStack;
  /** Where the outbox relay publishes: `none` is the in-memory bus of the same process. */
  readonly broker: BrokerStack;
  /** What backs the kernel `Cache` port, the relay signal and the rate limiter: the process itself, or a Redis protocol server. */
  readonly cache: CacheStack;
  /** Whether the audit trail is wired: decisions, commands and integration events, recorded from outside the use cases. */
  readonly audit: AuditMode;
}

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
  /** How the editor hook of the plugin reacts to a violation: `enforce`, `advise` or `off`. Kept as written, `check` reports a wrong value. */
  readonly guard: string;
  readonly deviations: readonly Deviation[];
  /** Names reported by `standard/no-parallel-interface`, over its defaults: the kernel interface to use instead, or `false` to drop a default. */
  readonly standardInterfaces: Readonly<Record<string, string | false>>;
}

interface Limits {
  readonly maxParameters: number;
  readonly maxFunctionLines: number;
}

const DEFAULT_LIMITS: Limits = { maxParameters: 3, maxFunctionLines: 30 };

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

/**
 * An integration event is declared with a payload schema, so a published language needs
 * the declaration helper and the schema library of the project, and nothing else.
 */
const SCHEMA_LIBRARIES: Readonly<Record<ValidationStack, readonly string[]>> = {
  zod: ['zod'],
  'class-validator': ['class-validator', 'class-transformer'],
  'standard-schema': [],
  none: [],
};

type AllowedPackages = Pick<Config, 'domainAllowedPackages' | 'applicationAllowedPackages' | 'publishedLanguageAllowedPackages'>;

/**
 * What the inner layers may import when the config says nothing; anything a config adds to
 * these is a deviation. The application layer declares its permissions and policies with
 * `@ddd-ts-kit/auth`, which imports the kernel only.
 */
export function defaultAllowedPackages(validation: string): AllowedPackages {
  const kernel = '@ddd-ts-kit/kernel';
  const schemaLibraries = isOneOf(VALIDATION_STACKS, validation) ? SCHEMA_LIBRARIES[validation] : [];
  return {
    domainAllowedPackages: [kernel],
    applicationAllowedPackages: [kernel, '@ddd-ts-kit/auth'],
    publishedLanguageAllowedPackages: [kernel, '@ddd-ts-kit/events', '@ddd-ts-kit/validation', ...schemaLibraries],
  };
}

/**
 * Tolerant on purpose: a wrong classification or an unknown upstream is reported by
 * `check` as `config/valid`, with a line number, instead of stopping every command.
 */
export function parseConfig(raw: unknown): Config {
  if (!isRecord(raw)) {
    throw new CliError(`${CONFIG_FILE} must hold a JSON object.`, 'Recreate it with `ddd-ts-kit init`.');
  }
  const sourceRoot = posix(text(raw['sourceRoot'], 'src'));
  const stack = parseStack(isRecord(raw['stack']) ? raw['stack'] : {});
  const defaults = defaultAllowedPackages(stack.validation);
  return {
    sourceRoot,
    contextsDir: posix(text(raw['contextsDir'], `${sourceRoot}/contexts`)),
    sharedKernelDir: posix(text(raw['sharedKernelDir'], `${sourceRoot}/shared-kernel`)),
    platformDir: posix(text(raw['platformDir'], `${sourceRoot}/platform`)),
    importAlias: text(raw['importAlias'], '@/'),
    stack,
    contexts: mapEntries(raw['contexts'], parseContext),
    rules: mapEntries(raw['rules'], String),
    domainAllowedPackages: strings(raw['domainAllowedPackages'], defaults.domainAllowedPackages),
    applicationAllowedPackages: strings(raw['applicationAllowedPackages'], defaults.applicationAllowedPackages),
    publishedLanguageAllowedPackages: strings(raw['publishedLanguageAllowedPackages'], defaults.publishedLanguageAllowedPackages),
    limits: parseLimits(raw['limits']),
    guard: text(raw['guard'], 'enforce'),
    deviations: parseDeviations(raw['deviations']),
    standardInterfaces: parseStandardInterfaces(raw['standardInterfaces']),
  };
}

function parseStack(stack: Record<string, unknown>): Stack {
  const choose = <T extends string>(key: string, values: readonly T[], fallback: T): T => pick(values, stack[key], { fallback, key: `stack.${key}` });
  const http = choose('http', HTTP_STACKS, 'express');
  const database = choose('database', DATABASE_STACKS, 'postgres');
  const orm = choose('orm', ORM_STACKS, 'drizzle');
  return {
    http,
    validation: choose('validation', VALIDATION_STACKS, 'zod'),
    di: choose('di', DI_STACKS, http === 'nest' ? 'nest' : 'tsyringe'),
    events: choose('events', EVENT_STACKS, database === 'none' ? 'in-memory' : 'outbox'),
    orm,
    database,
    tests: choose('tests', TEST_STACKS, 'vitest'),
    docsUi: choose('docsUi', DOCS_UIS, http === 'none' ? 'none' : 'swagger'),
    ci: choose('ci', CI_PLATFORMS, 'github'),
    authn: choose('authn', AUTHN_STACKS, 'jwt'),
    authz: choose('authz', AUTHZ_STACKS, 'rbac'),
    broker: choose('broker', BROKER_STACKS, 'none'),
    cache: choose('cache', CACHE_STACKS, 'none'),
    audit: choose('audit', AUDIT_MODES, orm === 'none' ? 'off' : 'on'),
  };
}

function mapEntries<T>(value: unknown, parse: (entry: unknown) => T): Record<string, T> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, parse(entry)])) : {};
}

function parseDeviations(value: unknown): Deviation[] {
  const entries: unknown[] = Array.isArray(value) ? value : [];
  return entries.filter(isRecord).map((entry) => ({ what: text(entry['what'], ''), adr: text(entry['adr'], ''), reason: text(entry['reason'], '') }));
}

function parseStandardInterfaces(value: unknown): Record<string, string | false> {
  const entries = Object.entries(isRecord(value) ? value : {}).flatMap(([name, instead]): [string, string | false][] => (instead === false || (typeof instead === 'string' && instead !== '') ? [[name, instead]] : []));
  return Object.fromEntries(entries);
}

function parseLimits(value: unknown): Limits {
  const raw = isRecord(value) ? value : {};
  const positive = (candidate: unknown, fallback: number): number =>
    typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0 ? candidate : fallback;
  return {
    maxParameters: positive(raw['maxParameters'], DEFAULT_LIMITS.maxParameters),
    maxFunctionLines: positive(raw['maxFunctionLines'], DEFAULT_LIMITS.maxFunctionLines),
  };
}

export interface LoadedConfig {
  readonly config: Config;
  /** Kept to report `config/valid` violations with a line number. */
  readonly text: string;
}

export function readConfig(root: string): LoadedConfig {
  const file = path.join(root, CONFIG_FILE);
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    throw new CliError(
      `No ${CONFIG_FILE} in ${root}.`,
      'Run `ddd-ts-kit init` at the project root, or pass --cwd <project root>.',
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new CliError(`${CONFIG_FILE} is not valid JSON.`, 'Fix the syntax; the file must be plain JSON.');
  }
  return { config: parseConfig(raw), text: content };
}

/** The config as written to disk: defaults are spelled out so the file documents itself. */
export function serializeConfig(config: Config): string {
  const contexts: Record<string, unknown> = {};
  for (const [name, context] of Object.entries(config.contexts)) {
    contexts[name] = {
      classification: context.classification,
      upstreams: context.upstreams,
      ...(context.extraDirectories.length > 0 ? { extraDirectories: context.extraDirectories } : {}),
      ...(context.deployable ? { deployable: true } : {}),
    };
  }
  const { publishedLanguageAllowedPackages: _derived, limits: _limits, guard: _guard, deviations, standardInterfaces, ...written } = config;
  const optional = { ...(deviations.length > 0 ? { deviations } : {}), ...(Object.keys(standardInterfaces).length > 0 ? { standardInterfaces } : {}) };
  return `${JSON.stringify({ ...written, contexts, ...optional }, null, 2)}\n`;
}

/** Changes the config text through its JSON value, so that what the user wrote elsewhere keeps its shape. */
export function editConfigText(content: string, edit: (raw: Record<string, unknown>) => void): string {
  const raw: unknown = JSON.parse(content);
  if (!isRecord(raw)) return content;
  edit(raw);
  return `${JSON.stringify(raw, null, 2)}\n`;
}

/**
 * Adds a context to the config text without reformatting what the user wrote
 * elsewhere (extra directories written as `{ path, reason }` keep their reason).
 */
export function addContextToConfigText(content: string, name: string, context: ContextConfig): string {
  const raw: unknown = JSON.parse(content);
  if (!isRecord(raw)) return content;
  const contexts = isRecord(raw['contexts']) ? raw['contexts'] : {};
  contexts[name] = { classification: context.classification, upstreams: context.upstreams };
  raw['contexts'] = contexts;
  return `${JSON.stringify(raw, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : fallback;
}

function pick<T extends string>(values: readonly T[], value: unknown, setting: { fallback: T; key: string }): T {
  if (value === undefined) return setting.fallback;
  if (isOneOf(values, value)) return value;
  throw new CliError(`${CONFIG_FILE}: "${setting.key}" is ${JSON.stringify(value)}.`, `Set "${setting.key}" to one of: ${values.join(', ')}.`);
}

function parseContext(value: unknown): ContextConfig {
  const raw = isRecord(value) ? value : {};
  const upstreams = Array.isArray(raw['upstreams']) ? raw['upstreams'] : [];
  const extra = Array.isArray(raw['extraDirectories']) ? raw['extraDirectories'] : [];
  return {
    classification: text(raw['classification'], ''),
    upstreams: upstreams.map(parseUpstream).filter((upstream) => upstream !== undefined),
    extraDirectories: extra.map(parseExtraDirectory).filter((directory) => directory !== undefined),
    deployable: raw['deployable'] === true,
  };
}

function parseUpstream(value: unknown): Upstream | undefined {
  if (typeof value === 'string') return { context: value, relationship: 'published-language' };
  if (!isRecord(value) || typeof value['context'] !== 'string') return undefined;
  return { context: value['context'], relationship: text(value['relationship'], 'published-language') };
}

/** An extra directory is a path, or `{ "path": ..., "reason": ... }` so the decision is documented. */
function parseExtraDirectory(value: unknown): string | undefined {
  if (typeof value === 'string') return posix(value);
  if (isRecord(value) && typeof value['path'] === 'string') return posix(value['path']);
  return undefined;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function posix(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
}
