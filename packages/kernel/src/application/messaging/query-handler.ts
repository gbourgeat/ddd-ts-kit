import type { Query } from './query.js';
import type { ResultOf } from './result-of.js';

export interface QueryHandler<Q extends Query<unknown>> {
  execute(query: Q): Promise<ResultOf<Q>>;
}
