import type { MessageType } from '../../application/messaging/message-type';
import type { Message } from '../../application/messaging/message';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { HandlerDeclaration } from '../model/handler-declaration';

type Handling = Omit<HandlerDeclaration, 'dependencies' | 'message'> & { readonly message: MessageType<Message> };

export function handling(declared: Handling, dependencies: DeclaredDependencies): HandlerDeclaration {
  return { ...declared, dependencies };
}
