import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { tenancyBypass } from './tenancy-bypass';
import { tenancyConfig } from './tenancy-config';

const RULE = 'tenancy/scoped-statement';
const TYPEORM_ADAPTER = `${PATHS.BILLING}/infrastructure/persistence/type-orm-invoice.repository.ts`;
const TYPEORM_READ_MODEL = `${PATHS.BILLING}/infrastructure/persistence/type-orm-invoice-totals.repository.ts`;

/** Every statement on the manager confined: the where spreads a helper, the row handed to insertIgnoringConflict names its tenant. */
const TYPEORM_SCOPED = `import { insertIgnoringConflict, ownTenantWhere, tenantWhere } from '@ddd-ts-kit/typeorm';
import { tenantScopeOf } from '@ddd-ts-kit/kernel';

export class TypeOrmInvoiceRepository {
  findById(id: string) {
    return this.database.manager().findOneBy(invoices, { id, ...tenantWhere(this.scope) });
  }

  search() {
    const mine = { ...tenantWhere(this.scope) };

    return this.database.manager().createQueryBuilder(invoices, 'invoice').where(mine).orderBy('invoice.id').getMany();
  }

  async insert(state: InvoiceState) {
    const row = { ...state, ...tenantScopeOf(this.scope) };

    return (await insertIgnoringConflict(this.database.manager(), invoices, row)) ? 1 : 0;
  }

  update(state: InvoiceState, expected: number) {
    const guarded = { id: state.id, version: expected, ...ownTenantWhere(this.scope) };

    return this.database.manager().update(invoices, guarded, state);
  }
}
`;

const TYPEORM_UNSCOPED = `export class TypeOrmInvoiceRepository {
  findById(id: string) {
    return this.database.manager().findOneBy(invoices, { id });
  }
}
`;

/** What the rule says of a TypeORM adapter: the statements on the manager, and a read model store with its tenant. */
export const TENANCY_TYPEORM_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a typeorm adapter with the helpers spread into every statement, and the row of insertIgnoringConflict named',
    expect: 'pass',
    files: project({ [TYPEORM_ADAPTER]: TYPEORM_SCOPED }, tenancyConfig('typeorm')),
  },
  {
    ruleId: RULE,
    name: 'a typeorm adapter that reads with no tenant condition',
    expect: { file: TYPEORM_ADAPTER },
    files: project({ [TYPEORM_ADAPTER]: TYPEORM_UNSCOPED }, tenancyConfig('typeorm')),
  },
  tenancyBypass('typeorm', 'a row saved by its key', 'return this.database.manager().save(invoices, row);'),
  tenancyBypass(
    'typeorm',
    'an update confined by the condition of a read only',
    'return this.database.manager().update(invoices, { id, ...tenantWhere(this.scope) }, row);',
  ),
  tenancyBypass('typeorm', 'an insert that names no tenant', 'return this.database.manager().insert(invoices, row);'),
  tenancyBypass(
    'typeorm',
    'a row handed to insertIgnoringConflict that names no tenant',
    'const row = { ...state, version: 1 };\n\n    return insertIgnoringConflict(this.database.manager(), invoices, row);',
  ),
  tenancyBypass(
    'typeorm',
    'a query builder with no tenant condition in its where',
    "return this.database.manager().createQueryBuilder(invoices, 'invoice').where({ id }).getOne();",
  ),
  {
    ruleId: RULE,
    name: 'typeorm: a query builder whose insert names the tenant in the row it is given',
    expect: 'pass',
    files: project(
      {
        [TYPEORM_ADAPTER]:
          'export class TypeOrmInvoiceRepository {\n  insert(state: InvoiceState) {\n    const row = { ...state, ...tenantScopeOf(this.scope) };\n\n    return this.database.manager().createQueryBuilder().insert().into(invoices).values(row).orIgnore().execute();\n  }\n\n  remove(id: string) {\n    const mine = { id, ...ownTenantWhere(this.scope) };\n\n    return this.database.manager().createQueryBuilder().delete().from(invoices).where(mine).execute();\n  }\n}\n',
      },
      tenancyConfig('typeorm'),
    ),
  },
  tenancyBypass('typeorm', 'raw SQL', "return this.database.manager().query('select * from billing.invoices');"),
  tenancyBypass(
    'typeorm',
    'the manager held in a variable',
    'const manager = this.database.manager();\n\n    return manager.findOneBy(invoices, { id, ...tenantWhere(this.scope) });',
  ),
  {
    ruleId: RULE,
    name: 'typeorm: the manager handed to a helper of its own, which confines it',
    expect: 'pass',
    files: project(
      {
        [TYPEORM_ADAPTER]:
          'export class TypeOrmInvoiceRepository {\n  totals() {\n    return sumPerStatus(this.database.manager(), this.scope);\n  }\n}\n',
      },
      tenancyConfig('typeorm'),
    ),
  },
  {
    ruleId: RULE,
    name: 'read model store on typeorm built with its tenant',
    expect: 'pass',
    files: project(
      {
        [TYPEORM_READ_MODEL]:
          'export class TypeOrmInvoiceTotals extends TypeOrmReadModelStore<Total> {\n  constructor(database: TypeOrmContext, scope: ExecutionScope) {\n    super(database, { entity: totals, definition, tenant: { scope } });\n  }\n}\n',
      },
      tenancyConfig('typeorm'),
    ),
  },
];
