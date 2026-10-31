@@imports
{{#unless adapter.decorated}}
import { retry, timeout } from '@ddd-ts-kit/aspects';
{{/unless}}
import { ownPolicy } from '{{alias.platform}}/resilience/own-policy{{alias.ext}}';
import { {{name.pascal}} } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
import { Remote{{name.pascal}} } from '{{alias.context}}/infrastructure/external/remote-{{name.kebab}}.adapter{{alias.ext}}';
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
