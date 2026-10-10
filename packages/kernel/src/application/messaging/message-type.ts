import type { Message } from './message.js';

export type MessageType<M extends Message> = abstract new (...args: never[]) => M;
