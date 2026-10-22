import type { MessageType } from '../../application/messaging/message-type';
import type { Message } from '../../application/messaging/message';
import type { Token } from '../token/token';

export interface HandlerDeclaration {
  readonly role: 'command-handler' | 'query-handler';
  readonly message: MessageType<Message>;
  readonly implementation: new (...args: never) => { readonly execute: (message: never) => Promise<unknown> };
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
}
