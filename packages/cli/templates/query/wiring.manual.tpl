@@imports
{{access.manualImport}}
{{access.permissionsImport}}
import { {{name.pascal}}Handler } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { InMemory{{name.pascal}}Reader } from '{{alias.context}}/infrastructure/persistence/{{reader.file}}.js';
@@registrations
const {{name.camel}}Reader = platform.adapter(new InMemory{{name.pascal}}Reader(), { kind: 'repository', context: '{{context.kebab}}' });

platform.queries.register({{name.pascal}}Query, new {{name.pascal}}Handler({{name.camel}}Reader), { context: '{{context.kebab}}' });
@@authorization
{{access.manualDeclaration}}
