import type { CommandHandler as CommandHandlerPort } from '../../application/messaging/command-handler.js';
import type { Command } from '../../application/messaging/command.js';
import type { MessageType } from '../../application/messaging/message-type.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { Dependencies } from '../dependencies/dependencies.js';
import type { MessageHandler } from '../model/message-handler.js';
import { record } from '../registry/record.js';
import { handling } from './handling.js';

/** The interface of the kernel under the name of its decorator, so one import serves both. */
export type CommandHandler<C extends Command<unknown>> = CommandHandlerPort<C>;

/**
 * The one handler of a command, with the ports of its constructor parameters in order:
 * `@CommandHandler(PlaceOrder, [OrderRepository, Clock])`. The list is left out for a constructor
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
