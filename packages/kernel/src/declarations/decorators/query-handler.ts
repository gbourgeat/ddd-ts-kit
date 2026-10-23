import type { MessageType } from '../../application/messaging/message-type';
import type { QueryHandler as QueryHandlerPort } from '../../application/messaging/query-handler';
import type { Query } from '../../application/messaging/query';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import type { MessageHandler } from '../model/message-handler';
import { record } from '../registry/record';
import { handling } from './handling';

/** The interface of the kernel under the name of its decorator, so one import serves both. */
export type QueryHandler<Q extends Query<unknown>> = QueryHandlerPort<Q>;

/** The one handler of a query: `@QueryHandler(GetOrder)`, its dependencies being the ports that type its constructor parameters. */
export function QueryHandler<
  Q extends Query<unknown>,
  const D extends DeclaredDependencies = DependenciesFromSignature,
>(message: MessageType<Q>, dependencies?: D): ClassDeclarator<MessageHandler<Q>, D> {
  return (target) => {
    record(target, handling({ role: 'query-handler', message, implementation: target }, dependencies));
  };
}
