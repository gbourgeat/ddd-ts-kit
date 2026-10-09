@@imports
{{access.permissionsImport}}
import type { {{name.pascal}}Reader } from './application/ports/{{name.kebab}}-reader.port.js';
import { {{name.pascal}}Handler } from './application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query } from './application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { InMemory{{name.pascal}}Reader } from './infrastructure/persistence/in-memory-{{name.kebab}}.reader.js';
@@tokens
export const {{name.constant}}_READER = token<{{name.pascal}}Reader>('{{context.kebab}}.{{name.pascal}}Reader');
@@registrations
builder.bind({{name.constant}}_READER).toFactory(() => new InMemory{{name.pascal}}Reader({})).as('repository');
builder.query({{name.pascal}}Query){{access.declaration}}.handledBy({{name.pascal}}Handler, [{{name.constant}}_READER]);
