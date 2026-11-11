{{#if tenant.scoped}}
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
{{#if style.declared}}
import { {{name.pascal}}, {{name.camel}}Criteria, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { {{name.camel}}Criteria, type {{name.pascal}}, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/unless}}
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

{{#if style.declared}}
@Repository({{name.pascal}})
{{/if}}
export class {{adapter.pascal}} extends KnexReadModelStore<{{name.pascal}}Row> implements {{name.pascal}} {
{{#if tenant.scoped}}
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(database: KnexContext, scope: ExecutionScope) {
{{/if}}
{{#unless tenant.scoped}}
  constructor(database: KnexContext) {
{{/unless}}
    super(database, {
{{#if tenant.scoped}}
      tenant: scope,
{{/if}}
      schema: {{context.constant}}_SCHEMA,
      table: '{{table}}',
      columns: {
        id: 'id',
{{#if fields.any}}
{{fields.names}}
{{/if}}
      },
      definition: {{name.camel}}Criteria,
    });
  }
}
