@@imports
import { token } from '@ddd-ts-kit/kernel/declarations';
import type { {{name.pascal}}Contract } from '../../../{{upstream.kebab}}/published-language/index.js';
import type { {{name.pascal}}Gateway } from './{{name.kebab}}-gateway.port.js';
@@tokens
export const {{name.constant}}_GATEWAY = token<{{name.pascal}}Gateway>('{{context.kebab}}.{{name.pascal}}Gateway');
export const {{name.constant}}_UPSTREAM = token<{{name.pascal}}Contract>('{{context.kebab}}.{{name.pascal}}Upstream');
