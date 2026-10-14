import type { Message, MessageInfo } from '@ddd-ts-kit/kernel';

/**
 * What the kernel buses ask before anything else, the unit of work included. Unbound, every
 * message passes; an authorization module binds the guard that asks its authorizer.
 */
export abstract class UseCaseGuard {
  static readonly tokenKey = 'di.UseCaseGuard';

  abstract check(message: Message, next: () => Promise<unknown>, info: MessageInfo): Promise<unknown>;

  /**
   * Run closest to the handler, inside the unit of work: what has to hold once the handler
   * returned, so that a failure here rolls the change back. Absent, the handler runs alone.
   */
  abstract within?(message: Message, next: () => Promise<unknown>, info: MessageInfo): Promise<unknown>;
}
