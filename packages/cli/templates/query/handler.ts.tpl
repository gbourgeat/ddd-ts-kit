{{#if access.policy}}
import type { Access } from '@ddd-ts-kit/auth';
{{/if}}
import type { QueryHandler } from '@ddd-ts-kit/kernel';
{{#if access.policy}}
{{access.useCasePermissionsImport}}
{{/if}}
import type { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import type { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

export class {{name.pascal}}Handler implements QueryHandler<{{name.pascal}}Query> {
{{#if access.policy}}
  constructor(
    private readonly reader: {{name.pascal}}Reader,
    private readonly access: Access,
  ) {}
{{/if}}
{{#unless access.policy}}
  constructor(private readonly reader: {{name.pascal}}Reader) {}
{{/unless}}

  async execute(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
{{#if access.policy}}
    // TODO(domain): a policy refines {{access.reference}}: ask it about the element "{{name.words}}" reads once it is read, in place of `query`.
    await this.access.authorize(query.actor, {{access.reference}}, query);

{{/if}}
    // TODO(domain): narrow what is read to what the asker may see: ask `Access.scope(query.actor, permission, '<type>')` for the scope and hand it to the reader, never filter in memory after loading; a query never changes state.
    return this.reader.read(query);
  }
}
