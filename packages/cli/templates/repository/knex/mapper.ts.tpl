import { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Columns, {{aggregate.pascal}}Row } from './{{context.kebab}}.schema.js';

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its columns.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, { registeredAt: row.registered_at });
    loaded.version = row.version;
    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): {{aggregate.pascal}}Columns {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its columns; nothing of the row type leaves this file.
    return { id: saved.id, registered_at: saved.toState().registeredAt };
  },
};
