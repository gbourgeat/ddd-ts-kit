import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { PublicUseCase } from './use-case-declaration';

/** Declares that anybody may send the command or query, the anonymous caller included. */
export function publicUseCase(type: MessageType<Message>): PublicUseCase {
  return { access: 'public', type };
}
