@@imports
{{access.manualImport}}
{{access.permissionsImport}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
@@registrations
{{#if command.hasAggregate}}
platform.commands.register({{name.pascal}}Command, new {{name.pascal}}Handler({{aggregate.camel}}Repository, platform.ids, platform.clock), { context: '{{context.kebab}}' });
{{/if}}
{{#unless command.hasAggregate}}
platform.commands.register({{name.pascal}}Command, new {{name.pascal}}Handler(), { context: '{{context.kebab}}' });
{{/unless}}
@@authorization
{{access.manualDeclaration}}
