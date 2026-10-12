@@imports
import type { {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';
@@tables
export const {{aggregate.tableCamel}} = new EntitySchema<{{aggregate.pascal}}Row>({
  name: '{{context.pascal}}{{aggregate.pascal}}',
  tableName: '{{aggregate.table}}',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    registeredAt: { name: 'registered_at', type: 'timestamptz' },
    // TODO(domain): add one column per field of {{aggregate.pascal}}State (and to {{aggregate.pascal}}Columns of {{aggregate.kebab}}-row.schema.ts), with the type and the constraints the storage must enforce; then run `npm run build && npm run db:generate migrations/<what-it-does>`.
    version: { type: 'int' },
    ...auditColumns(),
  },
});
