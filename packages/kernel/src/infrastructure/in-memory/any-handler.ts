import type { Message } from '../../application/messaging/message';

/**
 * Declared with method syntax on purpose: a method parameter is compared bivariantly, so a
 * handler of one message type can be stored next to the handlers of every other type.
 */
export interface AnyHandler {
  execute(message: Message): Promise<unknown>;
}
