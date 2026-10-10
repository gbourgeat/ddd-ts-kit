import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AnyMessageHandler } from '../wiring/any-message-handler.js';

interface HandlerRegistry {
  register(type: MessageType<Message>, handler: AnyMessageHandler): unknown;
}

/** A bus the declared handlers can be attached to: the in-process ones, not a remote transport. */
export function isHandlerRegistry(bus: unknown): bus is HandlerRegistry {
  return typeof bus === 'object' && bus !== null && 'register' in bus && typeof bus.register === 'function';
}
