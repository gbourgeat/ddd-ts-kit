@@imports
{{#if tenant.scoped}}
import type { TenantScoped } from '@ddd-ts-kit/kernel';
import { readModelColumns, tenantColumn, type ReadModelStamps } from '@ddd-ts-kit/typeorm';
{{/if}}
{{#unless tenant.scoped}}
import { readModelColumns, type ReadModelStamps } from '@ddd-ts-kit/typeorm';
{{/unless}}
import type { {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
@@tables
{{#if tenant.scoped}}
export const {{name.camel}} = new EntitySchema<{{name.pascal}}Row & TenantScoped & ReadModelStamps>({
  name: '{{context.pascal}}{{name.pascal}}',
  tableName: '{{table}}',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
{{#if fields.any}}
{{fields.typeormTable}}
{{/if}}
    // Kept out of the rows a read answers: the store writes the tenant of the work and confines every statement to it.
    tenantId: { ...tenantColumn().tenantId, select: false },
    ...readModelColumns(),
  },
  indices: [{ name: '{{table}}_tenant_idx', columns: ['tenantId', 'id'] }],
});
{{/if}}
{{#unless tenant.scoped}}
export const {{name.camel}} = new EntitySchema<{{name.pascal}}Row & ReadModelStamps>({
  name: '{{context.pascal}}{{name.pascal}}',
  tableName: '{{table}}',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
{{#if fields.any}}
{{fields.typeormTable}}
{{/if}}
    ...readModelColumns(),
  },
});
{{/unless}}
