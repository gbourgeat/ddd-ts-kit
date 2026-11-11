@@imports
{{#if fields.checked}}
import { sql } from 'drizzle-orm';
{{/if}}
{{#if tenant.scoped}}
import { index, {{fields.drizzleImports}} } from 'drizzle-orm/pg-core';
import { readModelColumns, tenantColumn } from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless tenant.scoped}}
import { {{fields.drizzleImports}} } from 'drizzle-orm/pg-core';
import { readModelColumns } from '@ddd-ts-kit/drizzle/postgres';
{{/unless}}
@@tables
{{#if fields.drizzleWide}}
export const {{name.camel}} = {{context.camel}}Schema.table(
  '{{table}}',
  {
    id: text('id').primaryKey(),
{{#if fields.any}}
{{fields.drizzleTable}}
{{/if}}
{{#if tenant.scoped}}
    ...tenantColumn(),
{{/if}}
    ...readModelColumns(),
  },
{{fields.drizzleExtras}}
);
{{/if}}
{{#unless fields.drizzleWide}}
export const {{name.camel}} = {{context.camel}}Schema.table('{{table}}', {
  id: text('id').primaryKey(),
{{#if fields.any}}
{{fields.drizzleTable}}
{{/if}}
  ...readModelColumns(),
});
{{/unless}}
