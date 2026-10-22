import type { Query } from '../messaging/query';
import type { ResultOf } from '../messaging/result-of';

export abstract class QueryBus {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.QueryBus' });
  }

  abstract execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>>;
}
