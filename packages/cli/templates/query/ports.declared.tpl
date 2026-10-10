@@imports
import { token } from '@ddd-ts-kit/kernel/declarations';
import type { {{name.pascal}}Reader } from './{{name.kebab}}-reader.port.js';
@@tokens
export const {{name.constant}}_READER = token<{{name.pascal}}Reader>('{{context.kebab}}.{{name.pascal}}Reader');
