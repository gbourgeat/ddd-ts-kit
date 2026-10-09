@@imports
{{access.manualImport}}
{{access.permissionsImport}}
import { traceUseCase } from '@ddd-ts-kit/tracing';
import { {{name.pascal}}Handler } from './application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query } from './application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { InMemory{{name.pascal}}Reader } from './infrastructure/persistence/in-memory-{{name.kebab}}.reader.js';
@@registrations
const {{name.camel}}Reader = platform.adapter(new InMemory{{name.pascal}}Reader([]), { kind: 'repository', context: '{{context.kebab}}' });
platform.queries.register({{name.pascal}}Query, traceUseCase(new {{name.pascal}}Handler({{name.camel}}Reader, platform.access), { context: '{{context.kebab}}' }));
@@authorization
{{access.manualDeclaration}}
