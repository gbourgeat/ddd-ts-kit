import { DEFAULT_STACK, type StackFlags } from '../helpers';

/**
 * The stacks that the workspace cannot run (their ORM is not installed at its root, or their client
 * is generated), installed for real at night with every capability on and held to their verify:
 * the specs of the platform then run the contracts of the kit on Prisma and TypeORM too.
 */
export const PROVEN_AT_NIGHT: readonly (readonly [string, StackFlags])[] = [
  [
    'the stack of the spend management example: NestJS, Prisma, Jest, Kafka, shared tables, the jobs in the database',
    {
      ...DEFAULT_STACK,
      http: 'nest',
      di: 'nest',
      validation: 'class-validator',
      tests: 'jest',
      orm: 'prisma',
      broker: 'kafka',
      cache: 'redis',
      tenancy: 'shared-table',
      queue: 'database',
      audit: 'on',
    },
  ],
  [
    'declared on TypeORM, shared tables, the jobs in the database, the audit trail',
    { ...DEFAULT_STACK, orm: 'typeorm', tenancy: 'shared-table', queue: 'database', audit: 'on' },
  ],
];

/** At night, and before a release, the proven stacks include those the workspace cannot run. */
export const NIGHT = process.env['DDD_TS_KIT_NIGHT'] === '1';

/** The release runs them alone: the other proven stacks ran on every pull request. */
export const NIGHT_ONLY = process.env['DDD_TS_KIT_NIGHT'] === 'only';

/**
 * What the night and the pull request of a release prove and no other run does: the intermediate states of
 * the first minute (after one context, then two) and the coverage gate on every proven stack. Every other
 * run, a workstation included, keeps the first state, the last one and one stack.
 */
export const DEEP = NIGHT || NIGHT_ONLY;
