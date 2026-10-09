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
      architectureToSource: relative('test/architecture', config.sourceRoot),
      appToSource: relative(`${config.sourceRoot}/apps/${context.kebab}`, config.sourceRoot),
    },
  };
}

export function stackVars(config: Config): RenderContext {
  const { http, validation, di, tests, orm, events, authn, authz, broker } = config.stack;
  const one = <T extends string>(value: T, options: readonly T[]): Record<string, boolean> =>
    Object.fromEntries(options.map((option) => [toName(option).camel, option === value]));
  return {
    http: { ...one(http, ['express', 'fastify', 'nest', 'none']), any: http !== 'none', plain: http === 'express' || http === 'fastify' },
    validation: one(validation, ['zod', 'class-validator', 'standard-schema', 'none']),
    di: one(di, ['tsyringe', 'nest', 'manual']),
    orm: { ...one(orm, ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none']), any: orm !== 'none' },
    events: { outbox: events === 'outbox', inMemory: events !== 'outbox', ...providerVars(broker) },
    // Authentication happens at the HTTP boundary: without one there is nobody to identify.
    authn: one(http === 'none' ? 'off' : authn, ['jwt', 'none']),
    authz: one(authz, ['rbac', 'abac', 'rebac', 'custom']),
    broker: { ...one(broker, ['none', 'rabbitmq', 'custom']), external: broker !== 'none', name: broker },
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

/** What `main.ts` calls to get the event provider of the chosen broker. */
function providerVars(broker: string) {
  if (broker === 'none') return { providerName: 'inProcessEvents', provider: 'inProcessEvents()' };
  return { providerName: 'createEventProvider', provider: broker === 'rabbitmq' ? 'createEventProvider(config)' : 'createEventProvider()' };
}

function relative(from: string, to: string): string {
  const result = path.posix.relative(from, to);
  return result.startsWith('.') ? result : `./${result}`;
}
