{{#if tenant.scoped}}
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import type { AuditStamp } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';

type {{aggregate.pascal}}Row = typeof {{aggregate.tableCamel}}.$inferSelect;

export type {{aggregate.pascal}}Columns = Omit<{{aggregate.pascal}}Row, 'version' | keyof AuditStamp{{#if tenant.scoped}} | keyof TenantScoped{{/if}}>;

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its columns.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, { registeredAt: row.registeredAt });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): {{aggregate.pascal}}Columns {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its columns; nothing of the row type leaves this file.
    return { id: saved.id, ...saved.toState() };
  },
};
