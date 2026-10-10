import type { MessageType } from '../../application/messaging/message-type.js';
import type { QueryHandler as QueryHandlerPort } from '../../application/messaging/query-handler.js';
import type { Query } from '../../application/messaging/query.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { Dependencies } from '../dependencies/dependencies.js';
import type { MessageHandler } from '../model/message-handler.js';
import { record } from '../registry/record.js';
import { handling } from './handling.js';

/** The interface of the kernel under the name of its decorator, so one import serves both. */
export type QueryHandler<Q extends Query<unknown>> = QueryHandlerPort<Q>;

/** The one handler of a query: `@QueryHandler(GetOrder, [OrderReadModel])`. */
export function QueryHandler<Q extends Query<unknown>, const D extends Dependencies = readonly []>(
  message: MessageType<Q>,
  dependencies?: D,
): ClassDeclarator<MessageHandler<Q>, D> {
  return (target) => {
    record(target, handling({ role: 'query-handler', message, implementation: target }, dependencies));
  };
}
