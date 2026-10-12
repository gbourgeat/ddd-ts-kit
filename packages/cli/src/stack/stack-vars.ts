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
import { usesLegacyDecorators } from './uses-legacy-decorators.js';

/** The choices of the stack as template variables: what every template of `init` and of `generate` reads. */
export function stackVars(config: Config): RenderContext {
  const { validation, di, tests, orm, authz, style, logger, refusals } = config.stack;
  const legacy = usesLegacyDecorators(config);

  return {
    style: one(style, ['declared', 'explicit']),
    assembly: assemblyVars(config),
    decorators: { legacy, standard: !legacy },
    http: httpVars(config),
    validation: one(validation, ['zod', 'class-validator', 'standard-schema', 'none']),
    di: one(di, ['tsyringe', 'nest', 'manual']),
    orm: { ...one(orm, ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none']), any: orm !== 'none' },
    events: eventVars(config),
    authn: authenticationVars(config),
    authz: one(authz, ['rbac', 'abac', 'rebac', 'custom']),
    broker: brokerVars(config),
    cache: cacheVars(config),
    redis: redisVars(config),
    audit: auditVars(config),
    errors: errorVars(config),
    refusals: one(refusals, ['factories', 'classes']),
    logger: one(logger, ['stdout', 'pino', 'winston']),
    tests: { ...one(tests, ['vitest', 'jest']), module: tests === 'jest' ? '@jest/globals' : 'vitest' },
    worker: { on: config.worker, off: !config.worker },
    config: platformPaths(config),
    alias: aliasVars(config),
    persistence: persistenceVars(config),
  };
}

function assemblyVars(config: Config): RenderContext {
  const { style, assembly } = config.stack;

  return {
    barrel: style === 'declared' && assembly === 'barrel',
    discovery: style === 'declared' && assembly === 'discovery',
  };
}

function httpVars(config: Config): RenderContext {
  const { http } = config.stack;

  return {
    ...one(http, ['express', 'fastify', 'nest', 'none']),
    any: http !== 'none',
    plain: http === 'express' || http === 'fastify',
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
