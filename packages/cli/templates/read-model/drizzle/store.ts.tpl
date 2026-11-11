import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { DrizzleReadModelStore } from '@ddd-ts-kit/drizzle/postgres';
{{#if tenant.scoped}}
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}, {{name.camel}}Criteria, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { {{name.camel}}Criteria, type {{name.pascal}}, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/unless}}
{{storage.adapterImport}}
import { {{name.camel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

{{#if style.declared}}
@Repository({{name.pascal}})
{{/if}}
export class {{adapter.pascal}} extends DrizzleReadModelStore<{{name.pascal}}Row, PgQueryResultHKT> implements {{name.pascal}} {
{{#if tenant.scoped}}
  constructor(database: Database, scope: ExecutionScope) {
{{/if}}
{{#unless tenant.scoped}}
  constructor(database: Database) {
{{/unless}}
    super(database, {
      table: {{name.camel}},
      key: {{name.camel}}.id,
      columns: {
        id: {{name.camel}}.id,
{{#if fields.any}}
{{fields.drizzleColumns}}
{{/if}}
      },
{{#if tenant.scoped}}
      tenant: { scope, column: {{name.camel}}.tenantId },
{{/if}}
      definition: {{name.camel}}Criteria,
    });
  }
}
