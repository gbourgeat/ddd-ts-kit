import { DEFAULT_STACK, EXPLICIT_STACK, type StackFlags } from '../helpers';
import { NEST_WITH_PASSPORT } from './nest-with-passport';

export const REBAC_ON_RABBITMQ: StackFlags = { ...DEFAULT_STACK, authz: 'rebac', broker: 'rabbitmq', ci: 'gitlab' };
export const ABAC_ON_KNEX_BY_HAND: StackFlags = { ...DEFAULT_STACK, orm: 'knex', di: 'manual', authz: 'abac' };
export const EXPLICIT_REBAC_ON_RABBITMQ: StackFlags = { ...REBAC_ON_RABBITMQ, style: 'explicit' };
/** The declared style with discovery in place of the barrel. */
export const DISCOVERED_ON_KNEX: StackFlags = { ...DEFAULT_STACK, orm: 'knex', assembly: 'discovery' };
/** Discovery behind a broker: each context listens on queues of its own, with no helper written for it. */
export const DISCOVERED_BEHIND_NATS: StackFlags = { ...DISCOVERED_ON_KNEX, broker: 'nats' };
/** Prisma on a platform wired by hand, and TypeORM on the declared style: the two ORMs the type check reads and this workspace cannot run. */
const PRISMA_BY_HAND: StackFlags = { ...DEFAULT_STACK, http: 'fastify', di: 'manual', orm: 'prisma' };
const TYPEORM_DECLARED: StackFlags = { ...DEFAULT_STACK, orm: 'typeorm' };

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

export const MULTI_TENANT_BEHIND_VARNISH: readonly StackFlags[] = [
  { ...DEFAULT_STACK, tenancy: 'shared-table', 'http-cache': 'varnish' },
  {
    http: 'fastify',
    validation: 'zod',
    di: 'manual',
    tests: 'vitest',
    orm: 'knex',
    events: 'outbox',
    tenancy: 'shared-table',
    'http-cache': 'varnish',
  },
  // The background jobs in the table of the tenant-scoped persistence, consumed by a platform wired by hand under Nest.
  {
    http: 'nest',
    validation: 'standard-schema',
    di: 'nest',
    tests: 'vitest',
    orm: 'knex',
    events: 'outbox',
    tenancy: 'shared-table',
    'http-cache': 'varnish',
    queue: 'database',
  },
];

/** Every combination the generator is held to: zero violation as generated, and a type check against the sources of the workspace. */
export const EVERY_STACK: readonly StackFlags[] = [
  DEFAULT_STACK,
  { http: 'fastify', validation: 'class-validator', di: 'manual', tests: 'vitest', orm: 'drizzle', events: 'outbox' },
  { http: 'nest', validation: 'standard-schema', di: 'nest', tests: 'vitest', orm: 'drizzle', events: 'in-memory' },
  { http: 'nest', validation: 'class-validator', di: 'nest', tests: 'vitest', orm: 'none', events: 'in-memory' },
  { http: 'express', validation: 'none', di: 'manual', tests: 'jest', orm: 'custom', events: 'outbox' },
  { http: 'fastify', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'none', events: 'outbox' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'custom', events: 'in-memory' },
  { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'knex', events: 'outbox' },
  PRISMA_BY_HAND,
  TYPEORM_DECLARED,
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
  /** Shared tables on the four ORMs: every repository confined to the tenant, the tenant kept in the outbox. */
  { ...DEFAULT_STACK, tenancy: 'shared-table' },
  { ...DISCOVERED_ON_KNEX, tenancy: 'shared-table' },
  { ...PRISMA_BY_HAND, tenancy: 'shared-table' },
  // The background jobs and the process instances in the tables of Prisma, consumed by a platform wired by hand under Nest.
  { ...PRISMA_BY_HAND, http: 'nest', di: 'nest', tenancy: 'shared-table', queue: 'database' },
  { ...TYPEORM_DECLARED, tenancy: 'shared-table' },
  /** Varnish in front of a multi-tenant API, on each family of wiring: the answers and the purges filed per tenant. */
  ...MULTI_TENANT_BEHIND_VARNISH,
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
  // The background jobs on the server of the cache, consumed by a platform wired by hand under Nest; the processes in the database.
  {
    http: 'nest',
    validation: 'standard-schema',
    di: 'nest',
    tests: 'vitest',
    orm: 'knex',
    events: 'outbox',
    cache: 'redis',
    broker: 'rabbitmq',
    queue: 'redis',
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
  // The background jobs on the server of the cache, a lost write reported to Sentry; the processes in the database.
  {
    http: 'none',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'knex',
    events: 'outbox',
    cache: 'redis',
    queue: 'redis',
    errors: 'sentry',
  },
  {
    http: 'fastify',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'none',
    events: 'in-memory',
    audit: 'on',
    cache: 'redis',
    queue: 'redis',
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
  {
    http: 'hono',
    validation: 'typebox',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'drizzle',
    events: 'outbox',
    cache: 'redis',
  },
  { http: 'fastify', validation: 'typebox', di: 'manual', tests: 'vitest', orm: 'knex', events: 'outbox' },
  /** The event store on each ORM and in memory, the privacy folder off on one of them, and the hand-wired foundations too wide for one line. */
  { ...DEFAULT_STACK, 'event-sourcing': 'on' },
  { ...ABAC_ON_KNEX_BY_HAND, errors: 'sentry', 'event-sourcing': 'on' },
  {
    http: 'fastify',
    validation: 'zod',
    di: 'manual',
    tests: 'vitest',
    orm: 'prisma',
    events: 'outbox',
    'event-sourcing': 'on',
  },
  {
    http: 'express',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'typeorm',
    events: 'outbox',
    'event-sourcing': 'on',
    privacy: 'off',
  },
  {
    http: 'nest',
    validation: 'standard-schema',
    di: 'nest',
    tests: 'vitest',
    orm: 'none',
    events: 'in-memory',
    'event-sourcing': 'on',
    privacy: 'on',
  },
  /** Nothing of the personal data: no folder, no script. */
  { ...DEFAULT_STACK, privacy: 'off' },
];

/**
 * A set of the stacks in which every value of every flag appears at least once, chosen greedily: each
 * round keeps the stack that brings the most values not met yet, the first of them on a tie. A flag a
 * stack leaves out takes its default, which counts as a value too. Computed from the stacks it is given,
 * so a value added to one of them is covered the day it lands.
 */
export function coverOf(stacks: readonly StackFlags[]): readonly StackFlags[] {
  const flags = [...new Set(stacks.flatMap((stack) => Object.keys(stack)))].sort();

  const valuesOf = (stack: StackFlags): readonly string[] => {
    const chosen = new Map<string, unknown>(Object.entries(stack));

    return flags.map((flag) => `${flag}=${String(chosen.get(flag) ?? '(default)')}`);
  };

  const missing = new Set(stacks.flatMap(valuesOf));
  const kept: StackFlags[] = [];

  while (missing.size > 0) {
    const best = stacks
      .map((stack) => ({ stack, gain: valuesOf(stack).filter((value) => missing.has(value)).length }))
      .reduce((most, candidate) => (candidate.gain > most.gain ? candidate : most));

    kept.push(best.stack);
    valuesOf(best.stack).forEach((value) => missing.delete(value));
  }

  return kept;
}

/**
 * What the pipeline hands over (`stacks` of `pipeline/monorepo/affected-packages.mjs`): `cover` on a
 * pull request that touches a template or a generator, `all` on the trunk, at night and on a release
 * (a pull request that touches neither runs none of these files). Unset on a workstation: every stack.
 */
const COVER = process.env['KIT_STACKS'] === 'cover';

/** The stacks of a sweep: every one, or the cover of them on a pull request. */
export function swept(stacks: readonly StackFlags[]): readonly StackFlags[] {
  return COVER ? coverOf(stacks) : stacks;
}

/** Every stack the generator is held to: generated, checked, formatted and type-checked, on a pull request too. */
export const STACKS: readonly StackFlags[] = EVERY_STACK;

/** The stacks held to everything a project runs in its pipeline, as generated. */
export const PROVEN: readonly (readonly [string, StackFlags])[] = [
  ['the default stack, declared: jwt, roles, no broker', DEFAULT_STACK],
  ['NestJS as its developers write it: Nest controllers, class-validator, Passport', NEST_WITH_PASSPORT],
  ['declared, relationships and RabbitMQ, GitLab pipeline', REBAC_ON_RABBITMQ],
  ['declared, discovered instead of listed in a barrel', DISCOVERED_ON_KNEX],
  ['declared, discovered behind NATS, failures reported to Sentry or GlitchTip', REPORTED_BEHIND_NATS],
  ['the default stack, declared, on InversifyJS', { ...DEFAULT_STACK, di: 'inversify' }],
  ['the default stack, declared, on Awilix', { ...DEFAULT_STACK, di: 'awilix' }],
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
 * The stacks the workspace can run as generated, on Vitest or on Jest (both installed at the workspace
 * root). Left out: prisma (its client has to be generated and a database reached) and typeorm (not
 * installed at the workspace root); the type check reads them, this does not run them. On a pull request,
 * the cover of them (`swept`).
 */
export const RUNNABLE: readonly StackFlags[] = swept(
  STACKS.filter((stack) => stack.orm !== 'prisma' && stack.orm !== 'typeorm'),
);

export const SLOW = process.env['DDD_TS_KIT_E2E'] === '1';
