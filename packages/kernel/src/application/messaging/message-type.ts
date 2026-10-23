import type { Message } from './message';

export type MessageType<M extends Message> = abstract new (...args: never[]) => M;
