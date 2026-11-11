@@imports
{{#if tenant.scoped}}
import { readModelColumns, tenantColumn } from '@ddd-ts-kit/knex';
{{/if}}
{{#unless tenant.scoped}}
import { readModelColumns } from '@ddd-ts-kit/knex';
{{/unless}}
@@tables
await create{{name.pascal}}Table(knex);
@@definitions
function create{{name.pascal}}Table(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('{{table}}', (table) => {
    table.text('id').primary();
{{#if fields.any}}
{{fields.knexTable}}
{{/if}}
{{#if tenant.scoped}}
    tenantColumn(table);
    table.index(['tenant_id', 'id'], '{{table}}_tenant_idx');
{{/if}}
    readModelColumns(table);
  });
}
