{{#if tenant.scoped}}
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import type { AuditStamp } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

type {{aggregate.pascal}}Row = typeof {{aggregate.tableCamel}}.$inferSelect;

export type {{aggregate.pascal}}Columns = Omit<{{aggregate.pascal}}Row, 'version' | keyof AuditStamp{{#if tenant.scoped}} | keyof TenantScoped{{/if}}>;

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its columns.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, {});

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): {{aggregate.pascal}}Columns {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its columns; nothing of the row type leaves this file.
{{#if personal.any}}
    return {
      id: saved.id,
      ...saved.toState(),
      // What the table keeps of the person, as its personal fields declare it: written here once the aggregate carries it, empty until then.
{{personal.nullColumns}}
    };
{{/if}}
{{#unless personal.any}}
    return { id: saved.id, ...saved.toState() };
{{/unless}}
  },
};
