@@imports
import type { {{aggregate.pascal}}Repository } from './domain/repositories/{{aggregate.kebab}}.repository.js';
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from './infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository.js';
{{#if adapter.needsDatabase}}
import { DATABASE } from '{{paths.contextToPlatform}}/platform.module.js';
{{/if}}
@@tokens
export const {{aggregate.constant}}_REPOSITORY = token<{{aggregate.pascal}}Repository>('{{context.kebab}}.{{aggregate.pascal}}Repository');
@@registrations
{{#if adapter.needsDatabase}}
builder.bind({{aggregate.constant}}_REPOSITORY).toClass({{adapter.pascal}}{{aggregate.pascal}}Repository, [DATABASE]).as('repository');
{{/if}}
{{#unless adapter.needsDatabase}}
builder.bind({{aggregate.constant}}_REPOSITORY).toClass({{adapter.pascal}}{{aggregate.pascal}}Repository).as('repository');
{{/unless}}
