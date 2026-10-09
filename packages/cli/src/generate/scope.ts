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
      contextToPlatform: relative(dir, config.platformDir),
      persistenceToPlatform: relative(`${dir}/infrastructure/persistence`, config.platformDir),
      integrationToPlatform: relative(`${dir}/test/integration`, config.platformDir),
      platformToContexts: relative(config.platformDir, config.contextsDir),
      databaseToContexts: relative(`${config.platformDir}/database`, config.contextsDir),
      persistenceToGenerated: relative(`${dir}/infrastructure/persistence`, 'generated'),
      scriptsToSource: relative('scripts', config.sourceRoot),
      e2eToSource: relative('test/e2e', config.sourceRoot),
      authorizationToPlatform: relative(`${dir}/application/authorization`, config.platformDir),
      authToContexts: relative(`${config.platformDir}/auth`, config.contextsDir),
      auditToContexts: relative(`${config.platformDir}/audit`, config.contextsDir),
      architectureToSource: relative('test/architecture', config.sourceRoot),
      appToSource: relative(`${config.sourceRoot}/apps/${context.kebab}`, config.sourceRoot),
    },
  };
}

export function stackVars(config: Config): RenderContext {
  const { http, validation, di, tests, orm, events, authz, broker } = config.stack;
  return {
    http: { ...one(http, ['express', 'fastify', 'nest', 'none']), any: http !== 'none', plain: http === 'express' || http === 'fastify' },
    validation: one(validation, ['zod', 'class-validator', 'standard-schema', 'none']),
    di: one(di, ['tsyringe', 'nest', 'manual']),
    orm: { ...one(orm, ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none']), any: orm !== 'none' },
    events: { outbox: events === 'outbox', inMemory: events !== 'outbox', wakeable: wakesTheRelay(config), ...providerVars(broker) },
    authn: authenticationVars(config),
    authz: one(authz, ['rbac', 'abac', 'rebac', 'custom']),
    broker: { ...one(broker, ['none', 'rabbitmq', 'custom']), external: broker !== 'none', name: broker },
    cache: cacheVars(config),
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
  };
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
  return { providerName: 'createEventProvider', provider: broker === 'rabbitmq' ? 'createEventProvider(config)' : 'createEventProvider()' };
}

function relative(from: string, to: string): string {
  const result = path.posix.relative(from, to);
  return result.startsWith('.') ? result : `./${result}`;
}
