@@imports
{{#unless adapter.decorated}}
import { retry, timeout } from '@ddd-ts-kit/aspects';
{{/unless}}
import { ownPolicy } from '{{paths.contextToPlatform}}/resilience/own-policy.js';
import { {{name.pascal}} } from './application/ports/{{name.kebab}}.port.js';
import { Remote{{name.pascal}} } from './infrastructure/external/remote-{{name.kebab}}.adapter.js';
@@registrations
{{#if adapter.decorated}}
builder.bind({{name.pascal}}).toClass(Remote{{name.pascal}}).as('{{adapter.kind}}').with(ownPolicy());
{{/if}}
{{#unless adapter.decorated}}
builder
  .bind({{name.pascal}})
  .toClass(Remote{{name.pascal}})
  .as('{{adapter.kind}}')
  .with(ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000)));
{{/unless}}
