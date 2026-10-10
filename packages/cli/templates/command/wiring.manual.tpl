@@imports
{{access.manualImport}}
{{access.permissionsImport}}
import { {{name.pascal}}Command } from './application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
import { {{name.pascal}}Handler } from './application/commands/{{name.kebab}}/{{name.kebab}}.handler.js';
@@registrations
{{#if command.hasAggregate}}
platform.commands.register({{name.pascal}}Command, new {{name.pascal}}Handler({{aggregate.camel}}Repository, platform.ids, platform.clock), { context: '{{context.kebab}}' });
{{/if}}
{{#unless command.hasAggregate}}
platform.commands.register({{name.pascal}}Command, new {{name.pascal}}Handler(), { context: '{{context.kebab}}' });
{{/unless}}
@@authorization
{{access.manualDeclaration}}
