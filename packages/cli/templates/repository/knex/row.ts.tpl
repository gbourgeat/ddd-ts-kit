{{#if tenant.scoped}}
import type { AuditRow, TenantRow } from '@ddd-ts-kit/knex';
{{/if}}
{{#unless tenant.scoped}}
import type { AuditRow } from '@ddd-ts-kit/knex';
{{/unless}}

export interface {{aggregate.pascal}}Columns {
  readonly id: string;
{{#if personal.any}}
{{personal.knexRow}}
{{/if}}
  // TODO(domain): add one column per field of {{aggregate.pascal}}State, as the table of create-{{context.kebab}}-tables.schema.ts declares it.
}

export interface {{aggregate.pascal}}Row extends {{aggregate.pascal}}Columns, {{#if tenant.scoped}}TenantRow, {{/if}}AuditRow {
  readonly version: number;
}
