import type { MessageType } from '../../application/messaging/message-type';
import type { Message } from '../../application/messaging/message';

/**
 * A class decorator of a command or a query, for both decorator modes of the compiler: the
 * standard (TC39) call hands it a context, the legacy `experimentalDecorators` call does not.
 */
export type MessageDeclarator<M extends Message> = (target: MessageType<M>, context?: ClassDecoratorContext) => void;
