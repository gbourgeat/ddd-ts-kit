import type { HandlerRegistration } from '../../application/messaging/handler-registration.js';
import type { MessageType } from '../../application/messaging/message-type.js';
import type { QueryHandler } from '../../application/messaging/query-handler.js';
import type { Query } from '../../application/messaging/query.js';
import type { ResultOf } from '../../application/messaging/result-of.js';
import type { QueryBus } from '../../application/ports/query-bus.js';
import { InProcessBus } from './in-process-bus.js';

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
