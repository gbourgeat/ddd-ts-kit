import type { Command } from '../messaging/command.js';
import type { ResultOf } from '../messaging/result-of.js';

/**
 * Driving ports of the application layer. Presentation and consumers depend on these,
 * never on a handler class, so the transport behind (in-process, queue, RPC) is a wiring choice.
 */
export abstract class CommandBus {
  static readonly tokenKey = 'kernel.CommandBus';

  abstract execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>>;
}
