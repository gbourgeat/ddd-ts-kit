import { Command } from '../../application/messaging/command.js';
import type { MessageInfo } from '../../application/messaging/message-info.js';
import type { MessageType } from '../../application/messaging/message-type.js';
import type { Message } from '../../application/messaging/message.js';
import { Query } from '../../application/messaging/query.js';
import { DeclarationError } from '../registry/declaration-error.js';

export function kindOf(target: MessageType<Message>): MessageInfo['kind'] {
  const prototype: unknown = target.prototype;

  if (prototype instanceof Command) return 'command';

  if (prototype instanceof Query) return 'query';

  throw new DeclarationError(
    `${target.name} declares who may send it and is neither a Command nor a Query of the kernel.`,
  );
}
