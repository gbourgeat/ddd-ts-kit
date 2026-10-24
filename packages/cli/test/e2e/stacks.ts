import { DEFAULT_STACK, EXPLICIT_STACK, type StackFlags } from '../helpers';

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
const EVERY_STACK: readonly StackFlags[] = [
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
  /** Shared tables on the four ORMs: every repository confined to the tenant, the tenant kept in the outbox. */
  { ...DEFAULT_STACK, tenancy: 'shared-table' },
  { ...DISCOVERED_ON_KNEX, tenancy: 'shared-table' },
  {
    http: 'fastify',
    validation: 'zod',
    di: 'manual',
    tests: 'vitest',
    orm: 'prisma',
    events: 'outbox',
    tenancy: 'shared-table',
  },
  {
    http: 'express',
    validation: 'zod',
    di: 'tsyringe',
    tests: 'vitest',
    orm: 'typeorm',
    events: 'outbox',
    tenancy: 'shared-table',
  },
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

/** The flags whose value names a package of the kit a project installs for it: an orm, a broker, a cache, a queue, an error reporter, a logger, a file storage. */
const NAMED_BY_A_FLAG: readonly (keyof StackFlags)[] = [
  'orm',
  'broker',
  'cache',
  'queue',
  'errors',
  'logger',
  'storage',
];

/** The error reporter a flag names under another name than its package. */
const PACKAGE_OF_VALUE: Readonly<Record<string, string>> = { glitchtip: 'sentry' };

/** The packages every generated project installs or is built, checked and tested with: a change there reaches every stack. */
const EVERYWHERE: readonly string[] = [
  'cli',
  'kernel',
  'testing',
  'eslint-plugin',
  'http',
  'validation',
  'di',
  'events',
  'auth',
  'audit',
  'tracing',
  'scheduling',
  'aspects',
];

/**
 * Whether a change of the packages `affected` reaches a stack: always when nothing is named
 * (the trunk, the night, a laptop) or when a package every project is built with is; otherwise
 * when a flag of the stack names one of them.
 */
export function reachedBy(affected: readonly string[], stack: StackFlags): boolean {
  if (affected.length === 0 || affected.some((name) => EVERYWHERE.includes(name))) {
    return true;
  }

  return NAMED_BY_A_FLAG.some((flag) => {
    const value = stack[flag];

    return typeof value === 'string' && affected.includes(PACKAGE_OF_VALUE[value] ?? value);
  });
}

/** What a pull request reaches, handed over by the pipeline (`pipeline/monorepo/affected-packages.mjs`); empty elsewhere. */
const AFFECTED = (process.env['KIT_AFFECTED'] ?? '').split(',').filter((name) => name !== '');

/** The stacks of a run: every one on the trunk and at night, the ones a change reaches on a pull request, the first at least so that every file runs something. */
function reached(stacks: readonly StackFlags[]): readonly StackFlags[] {
  const kept = stacks.filter((stack) => reachedBy(AFFECTED, stack));

  return kept.length === 0 ? stacks.slice(0, 1) : kept;
}

export const STACKS: readonly StackFlags[] = reached(EVERY_STACK);

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
 * The stacks the workspace can run as generated. Left out: jest (not installed in this workspace),
 * prisma (its client has to be generated and a database reached) and typeorm (not installed at the
 * workspace root); the type check reads the last two, this does not run them.
 */
export const RUNNABLE: readonly StackFlags[] = STACKS.filter(
  (stack) => stack.tests === 'vitest' && stack.orm !== 'prisma' && stack.orm !== 'typeorm',
);

export const SLOW = process.env['DDD_TS_KIT_E2E'] === '1';
