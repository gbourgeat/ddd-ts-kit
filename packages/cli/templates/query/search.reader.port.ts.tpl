import type { AccessScope } from '@ddd-ts-kit/auth';
import type { PageRequest } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Result, {{name.pascal}}Sort } from '../queries/{{name.kebab}}/{{name.kebab}}.result.js';

export abstract class {{name.pascal}}Reader {
  abstract search(scope: AccessScope, page: PageRequest<{{name.pascal}}Sort>): Promise<{{name.pascal}}Result>;
}
