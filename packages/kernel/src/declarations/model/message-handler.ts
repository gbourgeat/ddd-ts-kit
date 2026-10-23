import type { Message } from '../../application/messaging/message';
import type { ResultOf } from '../../application/messaging/result-of';

/**
 * What handles a command or a query. `execute` is declared as a property so that the compiler
 * compares its parameter strictly: the handler of another message is rejected.
 */
export interface MessageHandler<M extends Message> {
  readonly execute: (message: M) => Promise<ResultOf<M>>;
}
