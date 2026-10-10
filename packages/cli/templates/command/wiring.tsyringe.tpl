@@imports
{{#if command.hasAggregate}}
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { {{aggregate.pascal}}Repository } from './domain/repositories/{{aggregate.kebab}}.repository.js';
{{/if}}
{{access.permissionsImport}}
import { {{name.pascal}}Command } from './application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
import { {{name.pascal}}Handler } from './application/commands/{{name.kebab}}/{{name.kebab}}.handler.js';
@@registrations
{{#if command.hasAggregate}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler, [{{aggregate.pascal}}Repository, IdGenerator, Clock]);
{{/if}}
{{#unless command.hasAggregate}}
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler);
{{/unless}}
