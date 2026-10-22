import type { HandlerRegistration } from '../../application/messaging/handler-registration';
import type { MessageType } from '../../application/messaging/message-type';
import type { QueryHandler } from '../../application/messaging/query-handler';
import type { Query } from '../../application/messaging/query';
import type { ResultOf } from '../../application/messaging/result-of';
import type { QueryBus } from '../../application/ports/query-bus';
import { InProcessBus } from './in-process-bus';

export class InMemoryQueryBus extends InProcessBus implements QueryBus {
  constructor() {
    super('query');
  }

  register<Q extends Query<unknown>>(
    type: MessageType<Q>,
    handler: QueryHandler<Q>,
    registration?: HandlerRegistration,
  ): this {
    this.add(type, handler, registration);

    return this;
  }

  execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>> {
    return this.dispatch(query);
  }
}
