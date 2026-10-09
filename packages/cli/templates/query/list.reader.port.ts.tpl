import type { AccessScope } from '@ddd-ts-kit/auth';
import type { PageRequest } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Result, {{name.pascal}}Sort } from '../queries/{{name.kebab}}/{{name.kebab}}.query.js';

export interface {{name.pascal}}Reader {
  list(scope: AccessScope, page: PageRequest<{{name.pascal}}Sort>): Promise<{{name.pascal}}Result>;
}
