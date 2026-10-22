import type { HandlerRegistration, Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AnyMessageHandler } from '../wiring/any-message-handler';

interface HandlerRegistry {
  register(type: MessageType<Message>, handler: AnyMessageHandler, registration?: HandlerRegistration): unknown;
}

/** A bus the declared handlers can be attached to: the in-process ones, not a remote transport. */
export function isHandlerRegistry(bus: unknown): bus is HandlerRegistry {
  return typeof bus === 'object' && bus !== null && 'register' in bus && typeof bus.register === 'function';
}
