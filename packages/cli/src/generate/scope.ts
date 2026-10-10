import path from 'node:path';
import type { Config } from '../config.js';
import { CliError } from '../errors.js';
import { toName, type Name } from '../naming.js';
import type { RenderContext, RenderValue } from '../render.js';
import type { Workspace } from '../workspace.js';
import type { KindFlags, KindRequest } from './kind.js';

/** What every generator works with: the project, its stack and one bounded context. */
export interface Scope {
  readonly ws: Workspace;
  readonly config: Config;
  readonly context: Name;
  /** Directory of the context, relative to the project root. */
  readonly dir: string;
  readonly flags: KindFlags;
}

/** Opens the context named by the first positional argument of a request. */
export function openScope(request: KindRequest): Scope {
  const { ws, config, flags } = request;
  const context = toName(request.args[0] ?? '');
  if (config.contexts[context.kebab] === undefined) throw unknownContext(config, context);
  return { ws, config, context, dir: `${config.contextsDir}/${context.kebab}`, flags };
}

function unknownContext(config: Config, context: Name): CliError {
  const known = Object.keys(config.contexts);
  const create = `\`ddd-ts-kit generate context ${context.kebab} --classification <core|supporting|generic>\``;
  return new CliError(
    `Unknown context "${context.kebab}".`,
    known.length > 0 ? `Use one of: ${known.join(', ')}; or create it with ${create}.` : `Create it first with ${create}.`,
  );
}

export const named = (name: Name): RenderContext => ({ ...name });

export function vars(scope: Scope, extra: Record<string, RenderValue>): RenderContext {
  return { ...contextVars(scope.config, scope.context), ...extra };
}

export function contextVars(config: Config, context: Name): RenderContext {
  const dir = `${config.contextsDir}/${context.kebab}`;
  return {
    ...stackVars(config),
    context: { ...named(context), schema: context.kebab.replaceAll('-', '_') },
    paths: {
      contextToPlatform: relativeTo(dir, config.platformDir),
      persistenceToPlatform: relativeTo(`${dir}/infrastructure/persistence`, config.platformDir),
      integrationToPlatform: relativeTo(`${dir}/test/integration`, config.platformDir),
      platformToContexts: relativeTo(config.platformDir, config.contextsDir),
      databaseToContexts: relativeTo(`${config.platformDir}/database`, config.contextsDir),
      persistenceToGenerated: relativeTo(`${dir}/infrastructure/persistence`, 'generated'),
      scriptsToSource: relativeTo('scripts', config.sourceRoot),
      e2eToSource: relativeTo('test/e2e', config.sourceRoot),
      authorizationToPlatform: relativeTo(`${dir}/application/authorization`, config.platformDir),
      authToContexts: relativeTo(`${config.platformDir}/auth`, config.contextsDir),
      auditToContexts: relativeTo(`${config.platformDir}/audit`, config.contextsDir),
      architectureToSource: relativeTo('test/architecture', config.sourceRoot),
      appToSource: relativeTo(`${config.sourceRoot}/apps/${context.kebab}`, config.sourceRoot),
    },
  };
}

export function stackVars(config: Config): RenderContext {
  const { http, validation, di, tests, orm, events, authz, broker, style, assembly } = config.stack;
  return {
    style: one(style, ['declared', 'explicit']),
    assembly: { barrel: style === 'declared' && assembly === 'barrel', discovery: style === 'declared' && assembly === 'discovery' },
    decorators: decoratorVars(config),
    http: { ...one(http, ['express', 'fastify', 'nest', 'none']), any: http !== 'none', plain: http === 'express' || http === 'fastify' },
    validation: one(validation, ['zod', 'class-validator', 'standard-schema', 'none']),
    di: one(di, ['tsyringe', 'nest', 'manual']),
    orm: { ...one(orm, ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none']), any: orm !== 'none' },
    events: { outbox: events === 'outbox', inMemory: events !== 'outbox', wakeable: wakesTheRelay(config), ...providerVars(broker) },
    authn: authenticationVars(config),
    authz: one(authz, ['rbac', 'abac', 'rebac', 'custom']),
    broker: brokerVars(config),
    cache: cacheVars(config),
    redis: redisVars(config),
    audit: auditVars(config),
    tests: { ...one(tests, ['vitest', 'jest']), module: tests === 'jest' ? '@jest/globals' : 'vitest' },
    config: {
      sourceRoot: config.sourceRoot,
      contextsDir: config.contextsDir,
      sharedKernelDir: config.sharedKernelDir,
      platformDir: config.platformDir,
      importAlias: config.importAlias,
    },
    alias: { bare: config.importAlias.replace(/\/$/, '') },
    persistence: persistenceVars(config),
    platform: { diImports: platformImports(config) },
    composition: compositionVars(config),
  };
}

/** How the composition root hosts the contexts: their module files and route tokens, or their declarations and route lists. */
function compositionVars(config: Config) {
  const { style, assembly, http, broker } = config.stack;
  const declared = style === 'declared';
  const routed = http !== 'none';
  const listening = declared && assembly === 'barrel' && PROVIDED_BROKERS.includes(broker);
  return {
    buses: declared && routed,
    routeTokens: !declared && routed,
    contextModule: declared && !listening,
    listening,
    kernelTypes: composedKernelTypes(config, declared && routed),
    routesOf: declared ? 'routes(container.resolve(COMMAND_BUS), container.resolve(QUERY_BUS))' : 'container.resolve(routes)',
  };
}

/** The kernel types the composition root names: the buses only where it hands them to the routes of each context. */
function composedKernelTypes(config: Config, handsBuses: boolean): string {
  const limited = config.stack.cache === 'redis' && config.stack.http !== 'none';
  const types = [...(handsBuses ? ['CommandBus'] : []), 'IntegrationEventPublisher', 'IntegrationEventSubscriber', 'Logger', ...(handsBuses ? ['QueryBus'] : []), ...(limited ? ['RateLimiter'] : [])];
  return types.join(', ');
}

/** What the platform module takes from the container package: the tokens it binds itself are made with `token`. */
function platformImports(config: Config): string {
  const { broker, audit, style } = config.stack;
  const subscribes = broker !== 'none' || audit === 'on';
  const makesTokens = style === 'explicit' || broker !== 'none';
  return [...(subscribes ? ['EVENT_SUBSCRIBER'] : []), 'UNIT_OF_WORK', 'USE_CASE_GUARD', 'defineContextModule', 'kernelModule', ...(makesTokens ? ['token'] : []), 'type ContextModule', 'type Resolve'].join(', ');
}

/**
 * One program has one decorator mode: the legacy one wherever a library of the stack only has
 * legacy decorators (class-validator, NestJS), the standard one everywhere else. The declarations
 * of the kernel and the aspects serve both.
 */
export function usesLegacyDecorators(config: Config): boolean {
  return config.stack.http === 'nest' || config.stack.validation === 'class-validator';
}

function decoratorVars(config: Config) {
  const legacy = usesLegacyDecorators(config);
  return { legacy, standard: !legacy };
}

/** The brokers a provider package of the kit reaches: each gives every consuming context a subscriber of its own. */
export const PROVIDED_BROKERS: readonly string[] = ['rabbitmq', 'kafka', 'nats', 'redis'];

/** How the platform reaches a broker that has an address of its own: its environment variable, its key in the validated config, and what stands for "no broker" in the tests. */
const BROKER_ADDRESS: Readonly<Record<string, { variable: string; key: string; absent: string; reader: string }>> = {
  rabbitmq: { variable: 'AMQP_URL', key: 'amqpUrl', absent: 'amqp://in-process/tests', reader: 'readUrl' },
  // A list of `host:port`, which is not a URL.
  kafka: { variable: 'KAFKA_BROKERS', key: 'kafkaBrokers', absent: 'in-process:0', reader: 'readText' },
  nats: { variable: 'NATS_URL', key: 'natsUrl', absent: 'nats://in-process/tests', reader: 'readUrl' },
};

function brokerVars(config: Config) {
  const { broker } = config.stack;
  const address = BROKER_ADDRESS[broker];
  return {
    ...one(broker, ['none', 'rabbitmq', 'kafka', 'nats', 'redis', 'custom']),
    external: broker !== 'none',
    provided: PROVIDED_BROKERS.includes(broker),
    name: broker,
    // Redis Streams run on the Redis protocol server of the platform, behind REDIS_URL like the cache.
    addressed: address !== undefined,
    variable: address?.variable ?? '',
    key: address?.key ?? '',
    absent: address?.absent ?? '',
    reader: address?.reader ?? '',
    inProcessWhen: inProcessTest(broker, address?.key),
  };
}

/** What the end-to-end support of a project tests to keep its events in the process: the address of the broker was not given. */
function inProcessTest(broker: string, key: string | undefined): string {
  if (broker === 'redis') return 'config.redisUrl === NO_REDIS';
  return key === undefined ? '' : `config.${key} === NO_BROKER`;
}

/** One Redis protocol server for whatever asks for one: the cache, the rate limiter and the relay signal, the streams of the event bus. */
function redisVars(config: Config) {
  const { cache, broker } = config.stack;
  const streams = broker === 'redis';
  const uses = [...(cache === 'redis' ? ['cache, rate limiter, wake-up of the outbox relay'] : []), ...(streams ? ['streams of the integration events'] : [])];
  return { server: cache === 'redis' || streams, streams, service: cache === 'redis' ? 'cache' : 'streams', uses: uses.join(', ') };
}

/** One boolean per option, true for the chosen one: what a template tests with `{{#if stack.option}}`. */
function one<T extends string>(value: T, options: readonly T[]): Record<string, boolean> {
  return Object.fromEntries(options.map((option) => [toName(option).camel, option === value]));
}

/** Authentication happens at the HTTP boundary: without one there is nobody to identify. */
function authenticationVars(config: Config) {
  const authn = config.stack.http === 'none' ? 'off' : config.stack.authn;
  const tokens = authn === 'jwt' || authn === 'keycloak';
  return { ...one(authn, ['jwt', 'keycloak', 'none']), tokens, scheme: tokens ? 'bearer' : 'developmentActor' };
}

/** What a Redis protocol server brings: the cache, the limiter in front of HTTP, and the wake-up of the outbox relay. */
function cacheVars(config: Config) {
  const redis = config.stack.cache === 'redis';
  const { http, events } = config.stack;
  return { redis, none: !redis, rateLimit: redis && http !== 'none', relaySignal: redis && events === 'outbox' };
}

const WITH_AUDIT_STORE = ['knex', 'drizzle'];

/** Where the audit trail is kept: its SQL store with knex and drizzle, the memory of the process with anything else. */
function auditVars(config: Config) {
  const { audit, orm, http } = config.stack;
  const on = audit === 'on';
  const sql = on && WITH_AUDIT_STORE.includes(orm);
  return { on, off: !on, sql, memory: on && !sql, knex: on && orm === 'knex', drizzle: on && orm === 'drizzle', route: on && http !== 'none' };
}

const WITH_URL = ['drizzle', 'knex', 'prisma', 'typeorm'];

/** How the composition roots open the storage of the stack, and what the storage offers them. */
function persistenceVars(config: Config) {
  const { orm, http, di, events } = config.stack;
  const hasDatabase = WITH_URL.includes(orm);
  return {
    needsUrl: hasDatabase,
    hasDatabase,
    await: orm === 'typeorm' || orm === 'prisma' ? 'await ' : '',
    // The scripts that list routes and the hand-wired architecture test compose without connecting.
    inert: http !== 'none' || di !== 'tsyringe',
    signals: !hasDatabase && events === 'outbox',
  };
}

/** Whether something can wake the outbox relay before its next poll: the in-memory store, or a Redis protocol server. */
function wakesTheRelay(config: Config): boolean {
  const { orm, events, cache } = config.stack;
  return events === 'outbox' && (!WITH_URL.includes(orm) || cache === 'redis');
}

/** What `main.ts` calls to get the event provider of the chosen broker. */
function providerVars(broker: string) {
  if (broker === 'none') return { providerName: 'inProcessEvents', provider: 'inProcessEvents()' };
  return { providerName: 'createEventProvider', provider: PROVIDED_BROKERS.includes(broker) ? 'createEventProvider(config)' : 'createEventProvider()' };
}

/** The relative specifier from one directory of the project to another, always starting with a dot. */
export function relativeTo(from: string, to: string): string {
  const result = path.posix.relative(from, to);
  return result.startsWith('.') ? result : `./${result}`;
}
