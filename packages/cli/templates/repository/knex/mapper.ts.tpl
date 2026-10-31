import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{aggregate.pascal}}Columns, {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its columns.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, {});

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): {{aggregate.pascal}}Columns {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its columns; nothing of the row type leaves this file. A `jsonb` column holding an array or a string takes `jsonColumn(value)` of `@ddd-ts-kit/knex` on Knex, where the other ORM serialize it.
{{#if personal.any}}
    return {
      id: saved.id,
      // What the table keeps of the person, as its personal fields declare it: written here once the aggregate carries it, empty until then.
{{personal.nullColumns}}
    };
{{/if}}
{{#unless personal.any}}
    return { id: saved.id };
{{/unless}}
  },
};
