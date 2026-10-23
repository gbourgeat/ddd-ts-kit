import type { Message, MessageInfo, MessageType } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Requirement } from '../authorization/requirement';
import type { AnyMessageHandler } from './any-message-handler';
import type { Declarer } from './declarer';

export interface MessageHandling {
  readonly kind: MessageInfo['kind'];
  readonly message: MessageType<Message>;
  readonly handler: Token<AnyMessageHandler>;
  readonly module: string;
  /** Empty when neither the module nor the message declared an access. */
  readonly requirement: Requirement;
  readonly declaredBy?: Declarer;
}
