@@tables
export interface {{aggregate.pascal}}Row {
  id: string;
  createdAt: Date;
  version: number;
}
export const {{aggregate.tableCamel}} = new EntitySchema<{{aggregate.pascal}}Row>({
  name: '{{context.pascal}}{{aggregate.pascal}}',
  tableName: '{{aggregate.table}}',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    createdAt: { name: 'created_at', type: 'timestamptz' },
    // TODO(domain): add one column per field of {{aggregate.pascal}}State (and to {{aggregate.pascal}}Row above), with the type and the constraints the storage must enforce; then run `npm run db:generate`.
    version: { type: 'int' },
  },
});
