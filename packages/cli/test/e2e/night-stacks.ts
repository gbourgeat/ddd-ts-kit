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

/** At night the proven stacks include those the workspace cannot run. */
export const NIGHT = process.env['DDD_TS_KIT_NIGHT'] === '1';
