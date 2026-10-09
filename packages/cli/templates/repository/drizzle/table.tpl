@@tables
export const {{aggregate.tableCamel}} = {{context.camel}}Schema.table('{{aggregate.table}}', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  // TODO(domain): add one column per field of {{aggregate.pascal}}State, with the type and the constraints the storage must enforce; then run `npm run db:generate`.
  version: integer('version').notNull(),
});
