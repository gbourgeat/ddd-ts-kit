import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { aliasVars } from './alias-vars.js';
import { auditVars } from './audit-vars.js';
import { authenticationVars } from './authentication-vars.js';
import { brokerVars } from './broker-vars.js';
import { cacheVars } from './cache-vars.js';
import { errorVars } from './error-vars.js';
import { eventVars } from './event-vars.js';
import { one } from './one.js';
import { persistenceVars } from './persistence-vars.js';
import { redisVars } from './redis-vars.js';
import { filesVars } from './files-vars.js';
import { usesLegacyDecorators } from './uses-legacy-decorators.js';

/** The choices of the stack as template variables: what every template of `init` and of `generate` reads. */
export function stackVars(config: Config): RenderContext {
  const { validation, di, tests, orm, authz, style, logger, tenancy } = config.stack;
  const legacy = usesLegacyDecorators(config);

  return {
    style: one(style, ['declared', 'explicit']),
    assembly: assemblyVars(config),
    decorators: { legacy, standard: !legacy },
    ...edgeVars(config),
    validation: one(validation, ['zod', 'class-validator', 'typebox', 'standard-schema', 'none']),
    di: one(di, ['tsyringe', 'nest', 'manual']),
    orm: { ...one(orm, ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none']), any: orm !== 'none' },
    events: eventVars(config),
    authn: authenticationVars(config),
    authz: one(authz, ['rbac', 'abac', 'rebac', 'custom']),
    broker: brokerVars(config),
    cache: cacheVars(config),
    files: filesVars(config),
    redis: redisVars(config),
    audit: auditVars(config),
    errors: errorVars(config),
    ...modelWritingVars(config),
    routes: routeVars(config),
    presentation: presentationVars(config),
    logger: one(logger, ['stdout', 'pino', 'winston']),
    tests: { ...one(tests, ['vitest', 'jest']), module: tests === 'jest' ? '@jest/globals' : 'vitest' },
    worker: { on: config.worker, off: !config.worker },
    config: platformPaths(config),
    alias: aliasVars(config),
    persistence: persistenceVars(config),
    tenancy: { ...one(tenancy, ['none', 'shared-table']), any: tenancy !== 'none' },
    queue: queueVars(config),
  };
}

/**
 * `stored`: the jobs leave the memory of the process. `processTable`: the instances of the
 * process managers go to the database whenever the jobs leave memory and the ORM keeps them.
 */
function queueVars(config: Config): RenderContext {
  const { queue, orm } = config.stack;

  return {
    ...one(queue, ['memory', 'database', 'redis']),
    stored: queue !== 'memory',
    processTable: queue !== 'memory' && (orm === 'knex' || orm === 'drizzle'),
  };
}

/** How the code is written: its refusals, its shared schemas, its value objects, its closed values. */
function modelWritingVars(config: Config): RenderContext {
  const { refusals, schemas, valueObjects, literals } = config.stack;

  return {
    refusals: one(refusals, ['factories', 'classes']),
    schemas: one(schemas, ['shared', 'per-route']),
    valueObjects: one(valueObjects, ['throwing', 'result']),
    literals: one(literals, ['named', 'free']),
  };
}

/**
 * `listed`: the routes of a context are a list written in `<context>.routes.ts`. Declared
 * controllers reach the application by themselves, and the composition root mounts them in
 * either form of routes, so a project of function routes can write its first controller.
 */
function routeVars(config: Config): RenderContext {
  const { routes, style, http, audit } = config.stack;
  const declaredControllers = http !== 'none' && style === 'declared';

  return {
    ...one(routes, ['controllers', 'functions']),
    listed: http !== 'none' && !(style === 'declared' && routes === 'controllers'),
    declaredControllers,
    mountsControllers: declaredControllers || (http !== 'none' && audit === 'on' && routes === 'controllers'),
  };
}

/**
 * `negotiated`: the boundary registers the representations of the kit; `forms`: the composition
 * root serves the forms of the routes. Either one decides the restricted fields through the
 * `Access` of the application, which `presentation-of.ts` of the platform builds.
 */
function presentationVars(config: Config): RenderContext {
  const { http, representations, forms, audit } = config.stack;
  const negotiated = http !== 'none' && representations === 'negotiated';
  const served = http !== 'none' && forms === 'on';
  const any = negotiated || served;

  // The HTTP boundary takes more than its five ports when the audit trail or the presentation joins them.
  return { negotiated, forms: served, any, widensEdge: any || audit === 'on' };
}

function assemblyVars(config: Config): RenderContext {
  const { style, assembly } = config.stack;

  return {
    barrel: style === 'declared' && assembly === 'barrel',
    discovery: style === 'declared' && assembly === 'discovery',
  };
}

/** The HTTP framework, and the shared cache in front of it. */
function edgeVars(config: Config): RenderContext {
  const { httpCache, tenancy } = config.stack;
  // A multi-tenant application files its tags under the tenant, on the answers and on the purges alike.
  const perTenant = httpCache !== 'none' && tenancy !== 'none';

  return { http: httpVars(config), httpCache: { ...one(httpCache, ['none', 'varnish']), perTenant } };
}

function httpVars(config: Config): RenderContext {
  const { http } = config.stack;

  return {
    ...one(http, ['express', 'fastify', 'hono', 'nest', 'none']),
    any: http !== 'none',
    plain: http === 'express' || http === 'fastify' || http === 'hono',
  };
}

function platformPaths(config: Config): RenderContext {
  return {
    sourceRoot: config.sourceRoot,
    contextsDir: config.contextsDir,
    sharedKernelDir: config.sharedKernelDir,
    platformDir: config.platformDir,
    importAlias: config.importAlias,
  };
}
