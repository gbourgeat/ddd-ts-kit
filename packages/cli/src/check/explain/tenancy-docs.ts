import type { RuleDoc } from '../model/rule-doc.js';

export const TENANCY_DOCS: Readonly<Record<string, RuleDoc>> = {
  'tenancy/scoped-statement': {
    why: 'On shared tables, one statement without its tenant condition reads or overwrites the data of every tenant: the most common and the most damaging leak of a multi-tenant application. The kit puts the condition in one place, the helpers of the ORM package, which read the tenant from the execution scope, refuse work that names none, widen reads only under an audited elevation and never widen writes. A table reached straight from the executor bypasses all of it. Judged in a project whose "stack.tenancy" is not "none": the infrastructure of the contexts, tests aside. Checked by text, statement by statement: on Knex the executor used other than as the argument of a helper, and raw SQL; on Drizzle a read, update or delete whose where carries no tenant condition (inline or in the local it is given), an insert whose row names no tenant, a relational query or a raw execute; on both, a read model store built without its tenant option. A where built by another function is not followed: inline it, or record a deviation.',
    bad: `// infrastructure/persistence/knex-invoice.repository.ts
const row = await this.database.executor()<InvoiceRow, InvoiceRow[]>('invoices').where({ id }).first();
const all = await this.database.executor().from('invoices').where({ status }); // the executor chained
// infrastructure/persistence/drizzle-invoice.repository.ts
await this.database.executor().select().from(invoices).where(eq(invoices.id, id));
await this.database.executor().query.invoices.findMany(); // a relational query cannot carry the condition`,
    good: `const row = await tenantTable<InvoiceRow>(this.database, this.scope, INVOICES).where({ id }).first();
await ownTenantTable<InvoiceRow>(this.database, this.scope, INVOICES).where({ id, version }).update(changes);
await this.database.executor().select().from(invoices).where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)));`,
  },
};
