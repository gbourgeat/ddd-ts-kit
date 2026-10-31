@@imports
{{#if access.policy}}
import { Access } from '@ddd-ts-kit/auth';
{{/if}}
{{#if command.births}}
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if command.hasAggregate}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{access.permissionsImport}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
@@registrations
{{#if command.births}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler, [{{aggregate.pascal}}Repository, IdGenerator, Clock{{#if access.policy}}, Access{{/if}}]);
{{/if}}
{{#if command.changes}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler, [{{aggregate.pascal}}Repository{{#if access.policy}}, Access{{/if}}]);
{{/if}}
{{#unless command.hasAggregate}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler{{#if access.policy}}, [Access]{{/if}});
{{/unless}}
