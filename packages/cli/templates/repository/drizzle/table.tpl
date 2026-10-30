@@imports
{{#if tenant.scoped}}
import { index } from 'drizzle-orm/pg-core';
import { auditColumns, tenantColumn } from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless tenant.scoped}}
import { auditColumns } from '@ddd-ts-kit/drizzle/postgres';
{{/unless}}
{{#if personal.retains}}
import { timestamp } from 'drizzle-orm/pg-core';
{{/if}}
@@tables
{{#if tenant.scoped}}
export const {{aggregate.tableCamel}} = {{context.camel}}Schema.table(
  '{{aggregate.table}}',
  {
    id: text('id').primaryKey(),
{{#if personal.any}}
{{personal.drizzleTenantTable}}
{{/if}}
    // TODO(domain): add one column per field of {{aggregate.pascal}}State, with the type and the constraints the storage must enforce; then run `npm run db:generate <what-it-does>`.
    version: integer('version').notNull(),
    ...tenantColumn(),
    ...auditColumns(),
  },
  (table) => [index('{{aggregate.table}}_tenant_idx').on(table.tenantId, table.id)],
);
{{/if}}
{{#unless tenant.scoped}}
export const {{aggregate.tableCamel}} = {{context.camel}}Schema.table('{{aggregate.table}}', {
  id: text('id').primaryKey(),
{{#if personal.any}}
{{personal.drizzleTable}}
{{/if}}
  // TODO(domain): add one column per field of {{aggregate.pascal}}State, with the type and the constraints the storage must enforce; then run `npm run db:generate <what-it-does>`.
  version: integer('version').notNull(),
  ...auditColumns(),
});
{{/unless}}
