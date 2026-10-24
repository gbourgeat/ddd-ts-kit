@@imports
import { {{personal.names.exportAdapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.exportAdapterKebab}}.repository{{alias.ext}}';
@@exports
(platform) => platform.adapter(new {{personal.names.exportAdapter}}(platform.persistence.database{{#if tenant.scoped}}, platform.scope{{/if}}), { kind: 'repository', context: '{{context.kebab}}', token: '{{personal.names.exportPort}}' }),
