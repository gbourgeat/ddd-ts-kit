import type { CommandHandler } from '../../application/messaging/command-handler';
import type { Command } from '../../application/messaging/command';
import type { HandlerRegistration } from '../../application/messaging/handler-registration';
import type { MessageType } from '../../application/messaging/message-type';
import type { ResultOf } from '../../application/messaging/result-of';
import type { CommandBus } from '../../application/ports/command-bus';
import { InProcessBus } from './in-process-bus';

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
