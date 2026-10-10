import type { Message, MessageInfo } from '@ddd-ts-kit/kernel';

/**
 * What the kernel buses ask before anything else, the unit of work included. Unbound, every
 * message passes; an authorization module binds the guard that asks its authorizer.
 */
export abstract class UseCaseGuard {
  static readonly tokenKey = 'di.UseCaseGuard';

  abstract check(message: Message, next: () => Promise<unknown>, info: MessageInfo): Promise<unknown>;
}
