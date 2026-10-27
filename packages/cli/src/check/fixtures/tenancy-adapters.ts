import { PATHS } from './paths';

const PERSISTENCE = `${PATHS.BILLING}/infrastructure/persistence`;

/** The adapter of each ORM in the fixtures of the tenancy, and the class that owns it. */
export const TENANCY_ADAPTERS = {
  knex: { file: `${PERSISTENCE}/knex-invoice.repository.ts`, owner: 'KnexInvoiceRepository' },
  drizzle: { file: `${PERSISTENCE}/drizzle-invoice.repository.ts`, owner: 'DrizzleInvoiceRepository' },
  prisma: { file: `${PERSISTENCE}/prisma-invoice.repository.ts`, owner: 'PrismaInvoiceRepository' },
  typeorm: { file: `${PERSISTENCE}/type-orm-invoice.repository.ts`, owner: 'TypeOrmInvoiceRepository' },
} as const;
