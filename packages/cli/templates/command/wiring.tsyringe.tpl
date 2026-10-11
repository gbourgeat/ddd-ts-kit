@@imports
{{#if command.hasAggregate}}
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{access.permissionsImport}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
@@registrations
{{#if command.hasAggregate}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler, [{{aggregate.pascal}}Repository, IdGenerator, Clock]);
{{/if}}
{{#unless command.hasAggregate}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler);
{{/unless}}
