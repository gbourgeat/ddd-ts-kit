{{#if tenant.scoped}}
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type TypeOrmContext, TypeOrmReadModelStore } from '@ddd-ts-kit/typeorm';
{{#if style.declared}}
import { {{name.pascal}}, {{name.camel}}Criteria, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { {{name.camel}}Criteria, type {{name.pascal}}, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/unless}}
import { {{name.camel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

{{#if style.declared}}
@Repository({{name.pascal}})
{{/if}}
export class {{adapter.pascal}} extends TypeOrmReadModelStore<{{name.pascal}}Row> implements {{name.pascal}} {
{{#if tenant.scoped}}
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(database: TypeOrmContext, scope: ExecutionScope) {
    super(database, { entity: {{name.camel}}, tenant: { scope }, definition: {{name.camel}}Criteria });
  }
{{/if}}
{{#unless tenant.scoped}}
  constructor(database: TypeOrmContext) {
    super(database, { entity: {{name.camel}}, definition: {{name.camel}}Criteria });
  }
{{/unless}}
}
