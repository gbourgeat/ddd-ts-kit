import type { AuditStamp } from '@ddd-ts-kit/kernel';
import { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{context.pascal}}{{aggregate.pascal}} as {{aggregate.pascal}}Row } from '{{paths.persistenceToGenerated}}/prisma/client.js';

export type {{aggregate.pascal}}Columns = Omit<{{aggregate.pascal}}Row, 'version' | keyof AuditStamp>;

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its fields.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, { registeredAt: row.registeredAt });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): {{aggregate.pascal}}Columns {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its fields; nothing of the row type leaves this file.
    return { id: saved.id, ...saved.toState() };
  },
};
