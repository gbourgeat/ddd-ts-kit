import { DEFAULT_STACK, EXPLICIT_STACK, type StackFlags } from '../helpers.js';

export const REBAC_ON_RABBITMQ: StackFlags = { ...DEFAULT_STACK, authz: 'rebac', broker: 'rabbitmq', ci: 'gitlab' };
export const ABAC_ON_KNEX_BY_HAND: StackFlags = { ...DEFAULT_STACK, orm: 'knex', di: 'manual', authz: 'abac' };
export const EXPLICIT_REBAC_ON_RABBITMQ: StackFlags = { ...REBAC_ON_RABBITMQ, style: 'explicit' };
/** The declared style with discovery in place of the barrel. */
export const DISCOVERED_ON_KNEX: StackFlags = { ...DEFAULT_STACK, orm: 'knex', assembly: 'discovery' };
/** Discovery behind a broker: each context listens on queues of its own, with no helper written for it. */
export const DISCOVERED_BEHIND_NATS: StackFlags = { ...DISCOVERED_ON_KNEX, broker: 'nats' };

/** Unexpected failures reported to Sentry or GlitchTip, wired by hand: the buses, the jobs, the HTTP boundary, the events RabbitMQ gives up. */
const REPORTED_BY_HAND: StackFlags = {
  http: 'fastify',
  validation: 'zod',
  di: 'manual',
  tests: 'vitest',
  orm: 'knex',
  events: 'outbox',
  broker: 'rabbitmq',
  cache: 'redis',
  errors: 'sentry',
};

/** The same on the declared style, held to the whole pipeline: no DSN is configured, so the proof stays in the process. */
const REPORTED_BEHIND_NATS: StackFlags = { ...DISCOVERED_BEHIND_NATS, errors: 'sentry' };

/**
 * The stack of the example application: Keycloak, relationships, knex, the audit trail, classes
 * that declare themselves under the legacy decorator mode class-validator imposes, one Redis
 * protocol server for the cache and the event bus, or another broker next to the cache,
 * failures reported to Sentry or GlitchTip, pino for the logs and Varnish in front of the API.
 */
export const FIRST_CLASS: StackFlags = {
  http: 'express',
  validation: 'class-validator',
  di: 'tsyringe',
  tests: 'vitest',
  orm: 'knex',
  events: 'outbox',
  authn: 'keycloak',
  authz: 'rebac',
  broker: 'redis',
  cache: 'redis',
  'http-cache': 'varnish',
  audit: 'on',
  errors: 'sentry',
  logger: 'pino',
  style: 'declared',
};

export const FIRST_CLASS_BROKERS = ['redis', 'nats', 'kafka'] as const;

/** Every combination the generator is held to: zero violation as generated, and a type check against the sources of the workspace. */
export const STACKS: readonly StackFlags[] = [
  DEFAULT_STACK,
  { http: 'fastify', validation: 'class-validator', di: 'manual', tests: 'vitest', orm: 'drizzle', events: 'outbox' },
  { http: 'nest', validation: 'standard-schema', di: 'nest', tests: 'vitest', orm: 'drizzle', events: 'in-memory' },
  { http: 'nest', validation: 'class-validator', di: 'nest', tests: 'vitest', orm: 'none', events: 'in-memory' },
  { http: 'express', validation: 'none', di: 'manual', tests: 'jest', orm: 'custom', events: 'outbox' },
  { http: 'fastify', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'none', events: 'outbox' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'custom', events: 'in-memory' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox' },
  { http: 'fastify', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'prisma', events: 'outbox' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'typeorm', events: 'outbox' },
  { http: 'none', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'drizzle', events: 'outbox' },
  { http: 'none', validation: 'none', di: 'manual', tests: 'vitest', orm: 'none', events: 'in-memory' },
  REBAC_ON_RABBITMQ,
  ABAC_ON_KNEX_BY_HAND,
  {
    http: 'fastify',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'drizzle',
    events: 'outbox',
    authn: 'none',
    authz: 'custom',
    broker: 'custom',
  },
  {
    http: 'express',
    validation: 'zod',
    di: 'manual',
    tests: 'vitest',
    orm: 'custom',
    events: 'outbox',
    authn: 'none',
    authz: 'rebac',
    broker: 'rabbitmq',
  },
  ...FIRST_CLASS_BROKERS.map((broker) => ({ ...FIRST_CLASS, broker })),
  { ...FIRST_CLASS, broker: 'none' },
  { ...FIRST_CLASS, broker: 'rabbitmq', style: 'explicit' },
  EXPLICIT_STACK,
  EXPLICIT_REBAC_ON_RABBITMQ,
  DISCOVERED_ON_KNEX,
  DISCOVERED_BEHIND_NATS,
  { ...DEFAULT_STACK, broker: 'redis' },
  { ...DEFAULT_STACK, broker: 'kafka', orm: 'knex' },
  /** Shared tables on both ORMs that generate them: every repository confined to the tenant, the tenant kept in the outbox. */
  { ...DEFAULT_STACK, tenancy: 'shared-table' },
  { ...DISCOVERED_ON_KNEX, tenancy: 'shared-table' },
  { ...DEFAULT_STACK, broker: 'nats', style: 'explicit' },
  { ...DEFAULT_STACK, broker: 'kafka', style: 'explicit', cache: 'redis' },
  {
    http: 'fastify',
    validation: 'zod',
    di: 'manual',
    tests: 'vitest',
    orm: 'drizzle',
    events: 'outbox',
    authn: 'keycloak',
    cache: 'redis',
  },
  {
    http: 'nest',
    validation: 'standard-schema',
    di: 'nest',
    tests: 'vitest',
    orm: 'knex',
    events: 'outbox',
    cache: 'redis',
    broker: 'rabbitmq',
  },
  {
    http: 'express',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'drizzle',
    events: 'outbox',
    audit: 'off',
  },
  { http: 'none', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox', cache: 'redis' },
  {
    http: 'fastify',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'none',
    events: 'in-memory',
    audit: 'on',
    cache: 'redis',
  },
  REPORTED_BY_HAND,
  { ...REPORTED_BY_HAND, logger: 'winston' },
  { ...DEFAULT_STACK, logger: 'winston' },
  { ...ABAC_ON_KNEX_BY_HAND, logger: 'pino' },
  {
    http: 'nest',
    validation: 'standard-schema',
    di: 'nest',
    tests: 'vitest',
    orm: 'drizzle',
    events: 'outbox',
    logger: 'pino',
    errors: 'sentry',
  },
];

/** The stacks held to everything a project runs in its pipeline, as generated. */
export const PROVEN: readonly (readonly [string, StackFlags])[] = [
  ['the default stack, declared: jwt, roles, no broker', DEFAULT_STACK],
  ['declared, relationships and RabbitMQ, GitLab pipeline', REBAC_ON_RABBITMQ],
  ['declared, discovered instead of listed in a barrel', DISCOVERED_ON_KNEX],
  ['declared, discovered behind NATS, failures reported to Sentry or GlitchTip', REPORTED_BEHIND_NATS],
  ['the default stack in the explicit style', EXPLICIT_STACK],
  ['explicit, relationships and RabbitMQ, GitLab pipeline', EXPLICIT_REBAC_ON_RABBITMQ],
  ['explicit, attribute policies on knex, wired by hand', ABAC_ON_KNEX_BY_HAND],
  [
    'wired by hand behind RabbitMQ, failures reported, winston for the logs',
    { ...REPORTED_BY_HAND, logger: 'winston' },
  ],
];

export function label(stack: StackFlags): string {
  return Object.entries(stack)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(', ');
}

/**
 * The stacks the workspace can run as generated. Left out, as for the type check: jest (not
 * installed in this workspace), prisma (its client has to be generated first) and typeorm (not
 * installed at the workspace root).
 */
export const RUNNABLE: readonly StackFlags[] = STACKS.filter(
  (stack) => stack.tests === 'vitest' && stack.orm !== 'prisma' && stack.orm !== 'typeorm',
);

export const SLOW = process.env['DDD_TS_KIT_E2E'] === '1';
