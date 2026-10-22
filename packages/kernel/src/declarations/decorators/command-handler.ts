import type { CommandHandler as CommandHandlerPort } from '../../application/messaging/command-handler';
import type { Command } from '../../application/messaging/command';
import type { MessageType } from '../../application/messaging/message-type';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import type { MessageHandler } from '../model/message-handler';
import { record } from '../registry/record';
import { handling } from './handling';

/** The interface of the kernel under the name of its decorator, so one import serves both. */
export type CommandHandler<C extends Command<unknown>> = CommandHandlerPort<C>;

/**
 * The one handler of a command: `@CommandHandler(PlaceOrder)`. Its dependencies are the ports
 * that type its constructor parameters, read from the source by `ddd-ts-kit docs`. A list given
 * as the last argument, `@CommandHandler(PlaceOrder, [OrderRepository, Clock])`, is the form
 * 0.1 projects wrote: it is checked against the constructor and wins over the signature.
 */
export function CommandHandler<
  C extends Command<unknown>,
  const D extends DeclaredDependencies = DependenciesFromSignature,
>(message: MessageType<C>, dependencies?: D): ClassDeclarator<MessageHandler<C>, D> {
  return (target) => {
    record(target, handling({ role: 'command-handler', message, implementation: target }, dependencies));
  };
}
