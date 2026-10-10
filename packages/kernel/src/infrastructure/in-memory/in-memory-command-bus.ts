import type { CommandHandler } from '../../application/messaging/command-handler.js';
import type { Command } from '../../application/messaging/command.js';
import type { HandlerRegistration } from '../../application/messaging/handler-registration.js';
import type { MessageType } from '../../application/messaging/message-type.js';
import type { ResultOf } from '../../application/messaging/result-of.js';
import type { CommandBus } from '../../application/ports/command-bus.js';
import { InProcessBus } from './in-process-bus.js';

/** One handler per command type, resolved in process. The default CommandBus. */
export class InMemoryCommandBus extends InProcessBus implements CommandBus {
  constructor() {
    super('command');
  }

  register<C extends Command<unknown>>(
    type: MessageType<C>,
    handler: CommandHandler<C>,
    registration?: HandlerRegistration,
  ): this {
    this.add(type, handler, registration);

    return this;
  }

  execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>> {
    return this.dispatch(command);
  }
}
