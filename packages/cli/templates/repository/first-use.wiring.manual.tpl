@@imports
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from '{{alias.context}}/infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository{{alias.ext}}';
@@registrations
{{#if adapter.needsDatabase}}
const {{aggregate.camel}}Repository = platform.adapter(new {{adapter.pascal}}{{aggregate.pascal}}Repository(platform.persistence.database, platform.scope, platform.clock), { kind: 'repository', context: '{{context.kebab}}', token: '{{aggregate.pascal}}Repository' });
{{/if}}
{{#unless adapter.needsDatabase}}
const {{aggregate.camel}}Repository = platform.adapter(new {{adapter.pascal}}{{aggregate.pascal}}Repository(), { kind: 'repository', context: '{{context.kebab}}', token: '{{aggregate.pascal}}Repository' });
{{/unless}}
