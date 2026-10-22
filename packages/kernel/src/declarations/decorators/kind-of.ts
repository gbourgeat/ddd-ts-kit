import { Command } from '../../application/messaging/command';
import type { MessageInfo } from '../../application/messaging/message-info';
import type { MessageType } from '../../application/messaging/message-type';
import type { Message } from '../../application/messaging/message';
import { Query } from '../../application/messaging/query';
import { DeclarationError } from '../registry/declaration-error';

export function kindOf(target: MessageType<Message>): MessageInfo['kind'] {
  const prototype: unknown = target.prototype;

  if (prototype instanceof Command) {
    return 'command';
  }

  if (prototype instanceof Query) {
    return 'query';
  }

  throw new DeclarationError(
    `${target.name} declares who may send it and is neither a Command nor a Query of the kernel.`,
  );
}
