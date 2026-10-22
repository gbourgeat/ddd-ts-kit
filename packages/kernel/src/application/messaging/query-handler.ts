import type { Query } from './query';
import type { ResultOf } from './result-of';

export interface QueryHandler<Q extends Query<unknown>> {
  execute(query: Q): Promise<ResultOf<Q>>;
}
