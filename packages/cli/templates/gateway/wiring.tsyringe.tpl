@@imports
import type { {{name.pascal}}Contract } from '../{{upstream.kebab}}/published-language/index.js';
import type { {{name.pascal}}Gateway } from './application/ports/{{name.kebab}}-gateway.port.js';
import { InProcess{{name.pascal}}Gateway } from './infrastructure/external/in-process-{{name.kebab}}.gateway.js';
@@tokens
export const {{name.constant}}_GATEWAY = token<{{name.pascal}}Gateway>('{{context.kebab}}.{{name.pascal}}Gateway');
export const {{name.constant}}_UPSTREAM = token<{{name.pascal}}Contract>('{{context.kebab}}.{{name.pascal}}Upstream');
@@registrations
builder.bind({{name.constant}}_UPSTREAM).toValue({});
builder.bind({{name.constant}}_GATEWAY).toClass(InProcess{{name.pascal}}Gateway, [{{name.constant}}_UPSTREAM]).as('gateway');
