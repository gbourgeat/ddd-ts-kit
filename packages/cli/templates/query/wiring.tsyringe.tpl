@@imports
{{access.permissionsImport}}
import { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port.js';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { InMemory{{name.pascal}}Reader } from '{{alias.context}}/infrastructure/persistence/{{reader.file}}.js';
@@registrations
builder.bind({{name.pascal}}Reader).toClass(InMemory{{name.pascal}}Reader).as('repository');
builder.query({{name.pascal}}Query){{access.declaration}}.handledBy({{name.pascal}}Handler, [{{name.pascal}}Reader]);
