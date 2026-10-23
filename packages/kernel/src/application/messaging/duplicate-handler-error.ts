import type { MessageInfo } from './message-info';

export class DuplicateHandlerError extends Error {
  constructor(info: MessageInfo) {
    super(`A handler is already registered for ${info.kind} ${info.name}`);
    this.name = 'DuplicateHandlerError';
  }
}
