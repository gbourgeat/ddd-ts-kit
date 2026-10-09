@@imports
import { traceDependency } from '@ddd-ts-kit/tracing';
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from './infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository.js';
@@registrations
{{#if adapter.needsDatabase}}
const {{aggregate.camel}}Repository = traceDependency(new {{adapter.pascal}}{{aggregate.pascal}}Repository(platform.persistence.database), { kind: 'repository', context: '{{context.kebab}}' });
{{/if}}
{{#unless adapter.needsDatabase}}
const {{aggregate.camel}}Repository = traceDependency(new {{adapter.pascal}}{{aggregate.pascal}}Repository(), { kind: 'repository', context: '{{context.kebab}}' });
{{/unless}}
