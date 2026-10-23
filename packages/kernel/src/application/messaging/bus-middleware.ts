import type { MessageInfo } from './message-info';
import type { Message } from './message';

/** Cross-cutting behaviour (unit of work, logging, authorization) around every handler. */
export type BusMiddleware = (message: Message, next: () => Promise<unknown>, info: MessageInfo) => Promise<unknown>;
