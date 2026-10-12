import type { MessageType } from '../../application/messaging/message-type.js';
import type { Message } from '../../application/messaging/message.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { HandlerDeclaration } from '../model/handler-declaration.js';

type Handling = Omit<HandlerDeclaration, 'dependencies' | 'message'> & { readonly message: MessageType<Message> };

export function handling(declared: Handling, dependencies: DeclaredDependencies): HandlerDeclaration {
  return { ...declared, dependencies };
}
