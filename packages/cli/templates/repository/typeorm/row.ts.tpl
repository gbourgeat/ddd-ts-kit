{{#if tenant.scoped}}
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import type { AuditStamp } from '@ddd-ts-kit/kernel';
{{/unless}}

export interface {{aggregate.pascal}}Columns {
  id: string;
  registeredAt: Date;
  // TODO(domain): add one field per field of {{aggregate.pascal}}State, as the entity schema of {{context.kebab}}.schema.ts declares it.
}

export interface {{aggregate.pascal}}Row extends {{aggregate.pascal}}Columns, {{#if tenant.scoped}}TenantScoped, {{/if}}AuditStamp {
  version: number;
}
