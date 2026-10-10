import type { Message } from '@ddd-ts-kit/kernel';
import type { MessageHandler } from '@ddd-ts-kit/kernel/declarations';
import type { HandlerTarget } from './handler-target.js';

export interface UseCaseTarget<M extends Message> extends HandlerTarget<MessageHandler<M>> {
  /** Anybody reaches the handler, the anonymous caller included. Said, never implied. */
  public(): HandlerTarget<MessageHandler<M>>;
}
