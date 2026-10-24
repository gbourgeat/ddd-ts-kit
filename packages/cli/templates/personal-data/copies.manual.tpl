@@imports
import { {{personal.names.adapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.adapterKebab}}.repository{{alias.ext}}';
@@copies
(platform) => platform.adapter(new {{personal.names.adapter}}(platform.persistence.database{{#if tenant.scoped}}, platform.scope{{/if}}), { kind: 'repository', context: '{{context.kebab}}', token: '{{personal.names.port}}' }),
