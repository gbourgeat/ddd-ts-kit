@@imports
{{#unless adapter.decorated}}
import { retry, timeout } from '@ddd-ts-kit/aspects';
{{/unless}}
import { ownPolicy } from '{{paths.contextToPlatform}}/resilience.js';
import type { {{name.pascal}} } from './application/ports/{{name.kebab}}.port.js';
import { Remote{{name.pascal}} } from './infrastructure/external/remote-{{name.kebab}}.adapter.js';
@@tokens
export const {{name.constant}} = token<{{name.pascal}}>('{{context.kebab}}.{{name.pascal}}');
@@registrations
{{#if adapter.decorated}}
builder.bind({{name.constant}}).toFactory(() => new Remote{{name.pascal}}()).as('{{adapter.kind}}').with(ownPolicy());
{{/if}}
{{#unless adapter.decorated}}
builder.bind({{name.constant}}).toFactory(() => new Remote{{name.pascal}}()).as('{{adapter.kind}}').with(ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000)));
{{/unless}}
