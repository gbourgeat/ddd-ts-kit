@@imports
{{#if adapter.needsDatabase}}
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
{{storage.moduleImport}}
{{/if}}
import { {{aggregate.pascal}}Repository } from './domain/repositories/{{aggregate.kebab}}.repository.js';
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from './infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository.js';
@@registrations
{{#if adapter.needsDatabase}}
builder.bind({{aggregate.pascal}}Repository).toClass({{adapter.pascal}}{{aggregate.pascal}}Repository, [{{storage.token}}, ExecutionScope, Clock]).as('repository');
{{/if}}
{{#unless adapter.needsDatabase}}
builder.bind({{aggregate.pascal}}Repository).toClass({{adapter.pascal}}{{aggregate.pascal}}Repository).as('repository');
{{/unless}}
