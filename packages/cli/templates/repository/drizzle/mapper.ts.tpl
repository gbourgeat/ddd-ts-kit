import { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';

type {{aggregate.pascal}}Row = typeof {{aggregate.tableCamel}}.$inferSelect;

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its columns.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, { createdAt: row.createdAt });
    loaded.version = row.version;
    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): Omit<{{aggregate.pascal}}Row, {{tenant.omitted}}> {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its columns; nothing of the row type leaves this file.
    return { id: saved.id, ...saved.toState() };
  },
};
