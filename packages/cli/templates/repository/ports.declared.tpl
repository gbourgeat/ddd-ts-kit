@@imports
import { token } from '@ddd-ts-kit/kernel/declarations';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
@@tokens
export const {{aggregate.constant}}_REPOSITORY = token<{{aggregate.pascal}}Repository>('{{context.kebab}}.{{aggregate.pascal}}Repository');
