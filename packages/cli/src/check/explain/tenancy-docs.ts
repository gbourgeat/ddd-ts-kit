import type { RuleDoc } from '../model/rule-doc';

export const TENANCY_DOCS: Readonly<Record<string, RuleDoc>> = {
  'tenancy/scoped-statement': {
    why: 'On shared tables, one statement without its tenant condition reads or overwrites the data of every tenant: the most common and the most damaging leak of a multi-tenant application. The kit puts the condition in one place, the helpers of the ORM package, which read the tenant from the execution scope, refuse work that names none, widen reads only under an audited elevation and never widen writes. A table reached straight from the executor bypasses all of it. Judged in a project whose "stack.tenancy" is not "none": the infrastructure of the contexts, tests aside, but a context declared the control plane of the tenants ("contexts.<name>.tenancy": "control-plane", a deviation recorded in "deviations"), whose tables belong to no tenant since it decides who belongs to which (the identity preset declares its context so). Checked by text, statement by statement: on Knex the executor used other than as the argument of a helper, and raw SQL that may reach rows by itself: a word that reads or writes rows (`select`, `from`, `join`, `insert`, `update`, `delete`, `values`, `call`...) or starts a statement (`table`, `with`, `do`...), a call to a function that is not a known expression (an aggregate, a cast, arithmetic, text), a text that is not a literal or a template that interpolates; a statement of the schema (`create`, `alter`, `drop`, `comment`) with no word of rows, and an aggregate in a select, reach no row by themselves; on Drizzle a read, update or delete whose where carries no tenant condition (inline or in the local it is given), an insert whose row names no tenant, a relational query or a raw execute; on Prisma a statement on the client whose where spreads no `tenantWhere` (a read) or `ownTenantWhere` (an update, a delete), a create whose data spreads no `tenantScopeOf`, `findUnique` and `upsert`, which reach a row by its key when the tenant is never part of the key, raw SQL, and the client held in a variable; on TypeORM the same on the manager (`find*`, `count*`, `update`, `delete`, `insert`, a query builder whose where carries no condition, `insertIgnoringConflict` given a row that names no tenant, `save` and `upsert`, `query`); on the four, a read model store built without its tenant option. A where built by another function is not followed: inline it, or record a deviation.',
    bad: `// infrastructure/persistence/knex-invoice.repository.ts
const row = await this.database.executor()<InvoiceRow, InvoiceRow[]>('invoices').where({ id }).first();
const all = await this.database.executor().from('invoices').where({ status }); // the executor chained
// infrastructure/persistence/drizzle-invoice.repository.ts
await this.database.executor().select().from(invoices).where(eq(invoices.id, id));
await this.database.executor().query.invoices.findMany(); // a relational query cannot carry the condition
// infrastructure/persistence/prisma-invoice.repository.ts
const found = await this.database.client().billingInvoice.findUnique({ where: { id } }); // the key holds no tenant
await this.database.client().billingInvoice.updateMany({ where: { id, version }, data });
// infrastructure/persistence/type-orm-invoice.repository.ts
await this.database.manager().findOneBy(invoices, { id });
await this.database.manager().save(invoices, row); // writes by the key alone`,
    good: `const row = await tenantTable<InvoiceRow>(this.database, this.scope, INVOICES).where({ id }).first();
await ownTenantTable<InvoiceRow>(this.database, this.scope, INVOICES).where({ id, version }).update(changes);
const grouped = tenantTable(this.database, this.scope, INVOICES).select('status', this.database.executor().raw('sum(amount) as due')).groupBy('status');
const pages = await derivedTable(this.database, grouped, 'dues').orderBy('due', 'desc').limit(20);
await this.database.executor().select().from(invoices).where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)));
const found = await this.database.client().billingInvoice.findFirst({ where: { id, ...tenantWhere(this.scope) } });
await this.database.client().billingInvoice.updateMany({ where: { id, version, ...ownTenantWhere(this.scope) }, data });
await this.database.manager().findOneBy(invoices, { id, ...tenantWhere(this.scope) });
await this.database.manager().update(invoices, { id, version, ...ownTenantWhere(this.scope) }, row);`,
  },
};
