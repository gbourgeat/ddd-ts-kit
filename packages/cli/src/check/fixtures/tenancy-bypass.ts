import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { tenancyConfig } from './tenancy-config';

const PERSISTENCE = `${PATHS.BILLING}/infrastructure/persistence`;

/** The adapter of each ORM, and the class that owns it. */
const ADAPTERS = {
  knex: { file: `${PERSISTENCE}/knex-invoice.repository.ts`, owner: 'KnexInvoiceRepository' },
  drizzle: { file: `${PERSISTENCE}/drizzle-invoice.repository.ts`, owner: 'DrizzleInvoiceRepository' },
  prisma: { file: `${PERSISTENCE}/prisma-invoice.repository.ts`, owner: 'PrismaInvoiceRepository' },
  typeorm: { file: `${PERSISTENCE}/type-orm-invoice.repository.ts`, owner: 'TypeOrmInvoiceRepository' },
} as const;

/** A repository of a shared-table project whose one method goes around the helpers: what `tenancy/scoped-statement` reports. */
export function tenancyBypass(orm: keyof typeof ADAPTERS, name: string, body: string): Fixture {
  const { file: adapter, owner } = ADAPTERS[orm];

  return {
    ruleId: 'tenancy/scoped-statement',
    name: `${orm}: ${name}`,
    expect: { file: adapter },
    files: project({ [adapter]: `export class ${owner} {\n  find() {\n    ${body}\n  }\n}\n` }, tenancyConfig(orm)),
  };
}
