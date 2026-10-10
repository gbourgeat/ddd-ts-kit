import type { Query } from '../messaging/query.js';
import type { ResultOf } from '../messaging/result-of.js';

export abstract class QueryBus {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.QueryBus' });
  }

  abstract execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>>;
}
