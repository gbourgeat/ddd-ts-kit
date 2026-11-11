@@imports
{{#if tenant.scoped}}
import { index, {{fields.drizzleImports}} } from 'drizzle-orm/pg-core';
import { readModelColumns, tenantColumn } from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless tenant.scoped}}
import { {{fields.drizzleImports}} } from 'drizzle-orm/pg-core';
import { readModelColumns } from '@ddd-ts-kit/drizzle/postgres';
{{/unless}}
@@tables
{{#if tenant.scoped}}
export const {{name.camel}} = {{context.camel}}Schema.table(
  '{{table}}',
  {
    id: text('id').primaryKey(),
{{#if fields.any}}
{{fields.drizzleTable}}
{{/if}}
    ...tenantColumn(),
    ...readModelColumns(),
  },
  (table) => [index('{{table}}_tenant_idx').on(table.tenantId, table.id)],
);
{{/if}}
{{#unless tenant.scoped}}
export const {{name.camel}} = {{context.camel}}Schema.table('{{table}}', {
  id: text('id').primaryKey(),
{{#if fields.any}}
{{fields.drizzleTable}}
{{/if}}
  ...readModelColumns(),
});
{{/unless}}
