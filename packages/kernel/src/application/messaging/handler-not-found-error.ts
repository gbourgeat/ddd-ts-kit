import type { MessageInfo } from './message-info.js';

export class HandlerNotFoundError extends Error {
  constructor(info: MessageInfo) {
    super(`No handler registered for ${info.kind} ${info.name}`);
    this.name = 'HandlerNotFoundError';
  }
}
