@@imports
import { {{name.pascal}}Contract } from '../{{upstream.kebab}}/published-language/index.js';
import { {{name.pascal}}Gateway } from './application/ports/{{name.kebab}}-gateway.port.js';
import { InProcess{{name.pascal}}Gateway } from './infrastructure/external/in-process-{{name.kebab}}.gateway.js';
@@registrations
builder.bind({{name.pascal}}Contract).toValue({});
builder.bind({{name.pascal}}Gateway).toClass(InProcess{{name.pascal}}Gateway, [{{name.pascal}}Contract]).as('gateway');
