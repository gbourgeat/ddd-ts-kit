@@imports
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from './infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository.js';
@@registrations
{{#if adapter.needsDatabase}}
const {{aggregate.camel}}Repository = platform.adapter(new {{adapter.pascal}}{{aggregate.pascal}}Repository(platform.persistence.database, platform.scope, platform.clock), { kind: 'repository', context: '{{context.kebab}}' });
{{/if}}
{{#unless adapter.needsDatabase}}
const {{aggregate.camel}}Repository = platform.adapter(new {{adapter.pascal}}{{aggregate.pascal}}Repository(), { kind: 'repository', context: '{{context.kebab}}' });
{{/unless}}
