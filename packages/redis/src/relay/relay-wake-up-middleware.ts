import type { BusMiddleware } from '@ddd-ts-kit/kernel';

/**
 * Notifies after each command that succeeded. Install it before `unitOfWorkMiddleware`, so
 * that the notification leaves once the transaction that appended to the outbox has
 * committed. A command that published nothing wakes the relay for nothing, which costs one
 * empty claim.
 */
export function relayWakeUpMiddleware(signal: { notify(): Promise<void> }): BusMiddleware {
  return async (_message, next, info) => {
    const result = await next();

    if (info.kind === 'command') {
      void signal.notify().catch(() => undefined);
    }

    return result;
  };
}
