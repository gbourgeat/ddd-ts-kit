@@imports
{{#if tenant.scoped}}
import { auditColumns, tenantColumn } from '@ddd-ts-kit/knex';
{{/if}}
{{#unless tenant.scoped}}
import { auditColumns } from '@ddd-ts-kit/knex';
{{/unless}}
@@tables
await create{{aggregate.pascal}}Table(knex);
@@definitions
function create{{aggregate.pascal}}Table(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('{{aggregate.table}}', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    // TODO(domain): add one column per field of {{aggregate.pascal}}State (and to {{aggregate.pascal}}Columns of {{aggregate.kebab}}-row.schema.ts), with the type and the constraints the storage must enforce.
    table.integer('version').notNullable();
{{#if tenant.scoped}}
    tenantColumn(table);
    table.index(['tenant_id', 'id'], '{{aggregate.table}}_tenant_idx');
{{/if}}
    auditColumns(table);
  });
}
