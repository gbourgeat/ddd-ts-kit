import type {
  Command,
  CommandHandler as CommandHandlerPort,
  Message,
  MessageType,
  Query,
  QueryHandler as QueryHandlerPort,
} from '../application/bus.js';
import type { HandlerDeclaration, MessageHandler } from './declaration.js';
import type { ClassDeclarator, Dependencies } from './dependencies.js';
import { record } from './registry.js';

/** The interface of the kernel under the name of its decorator, so one import serves both. */
export type CommandHandler<C extends Command<unknown>> = CommandHandlerPort<C>;

/** The interface of the kernel under the name of its decorator, so one import serves both. */
export type QueryHandler<Q extends Query<unknown>> = QueryHandlerPort<Q>;

/**
 * The one handler of a command, with the tokens of its constructor parameters in order:
 * `@CommandHandler(PlaceOrder, [ORDERS, CLOCK])`. The list is left out for a constructor
 * without parameters.
 */
export function CommandHandler<C extends Command<unknown>, const D extends Dependencies = readonly []>(
  message: MessageType<C>,
  dependencies?: D,
): ClassDeclarator<MessageHandler<C>, D> {
  return (target) => {
    record(target, handling({ role: 'command-handler', message, implementation: target }, dependencies));
  };
}

/** The one handler of a query: `@QueryHandler(GetOrder, [ORDER_READS])`. */
export function QueryHandler<Q extends Query<unknown>, const D extends Dependencies = readonly []>(
  message: MessageType<Q>,
  dependencies?: D,
): ClassDeclarator<MessageHandler<Q>, D> {
  return (target) => {
    record(target, handling({ role: 'query-handler', message, implementation: target }, dependencies));
  };
}

type Handling = Omit<HandlerDeclaration, 'dependencies' | 'message'> & { readonly message: MessageType<Message> };

function handling(declared: Handling, dependencies: Dependencies = []): HandlerDeclaration {
  return { ...declared, dependencies };
}
