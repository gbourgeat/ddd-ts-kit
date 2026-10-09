@@tables
export interface {{aggregate.pascal}}Columns {
  id: string;
  registeredAt: Date;
}
export interface {{aggregate.pascal}}Row extends {{aggregate.pascal}}Columns, AuditStamp {
  version: number;
}
export const {{aggregate.tableCamel}} = new EntitySchema<{{aggregate.pascal}}Row>({
  name: '{{context.pascal}}{{aggregate.pascal}}',
  tableName: '{{aggregate.table}}',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    registeredAt: { name: 'registered_at', type: 'timestamptz' },
    // TODO(domain): add one column per field of {{aggregate.pascal}}State (and to {{aggregate.pascal}}Columns above), with the type and the constraints the storage must enforce; then run `npm run db:generate`.
    version: { type: 'int' },
    ...auditColumns(),
  },
});
