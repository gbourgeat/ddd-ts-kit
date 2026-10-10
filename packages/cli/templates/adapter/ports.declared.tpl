@@imports
import { token } from '@ddd-ts-kit/kernel/declarations';
import type { {{name.pascal}} } from './{{name.kebab}}.port.js';
@@tokens
export const {{name.constant}} = token<{{name.pascal}}>('{{context.kebab}}.{{name.pascal}}');
