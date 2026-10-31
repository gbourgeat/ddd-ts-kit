@@imports
import { FileStaging } from '@ddd-ts-kit/kernel';
{{access.permissionsImport}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
@@registrations
builder.command({{name.pascal}}Command){{access.declaration}}.handledBy({{name.pascal}}Handler, [FileStaging]);
