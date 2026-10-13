@@imports
{{access.manualImport}}
{{access.permissionsImport}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
@@registrations
platform.commands.register({{name.pascal}}Command, new {{name.pascal}}Handler(platform.files.staging), { context: '{{context.kebab}}' });
@@authorization
{{access.manualDeclaration}}
