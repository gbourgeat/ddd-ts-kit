{{#if tenant.scoped}}
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { PrismaReadModelStore } from '@ddd-ts-kit/prisma';
{{#if style.declared}}
import { {{name.pascal}}, {{name.camel}}Criteria, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { {{name.camel}}Criteria, type {{name.pascal}}, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/unless}}
{{storage.adapterImport}}
import type { Prisma } from '{{alias.generated}}/prisma/client{{alias.ext}}';

{{#if style.declared}}
@Repository({{name.pascal}})
{{/if}}
export class {{adapter.pascal}} extends PrismaReadModelStore<{{name.pascal}}Row, Prisma.TransactionClient> implements {{name.pascal}} {
{{#if tenant.scoped}}
  /** Tenant data: every row is written in, and every read confined to, the tenant of the work. */
  constructor(database: Database, scope: ExecutionScope) {
{{/if}}
{{#unless tenant.scoped}}
  constructor(database: Database) {
{{/unless}}
    super(database, {
      delegate: (client) => client.{{context.camel}}{{name.pascal}},
      schema: '{{context.schema}}',
      table: '{{table}}',
      columns: {
        id: 'id',
{{#if fields.any}}
{{fields.names}}
{{/if}}
      },
{{#if tenant.scoped}}
      tenant: { scope },
{{/if}}
      definition: {{name.camel}}Criteria,
    });
  }
}
