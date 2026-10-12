import type { CatchUpSubscription, Logger } from '@ddd-ts-kit/kernel';

export interface CatchUpOptions {
  readonly subscriptions: readonly CatchUpSubscription[];
  readonly intervalMs: number;
  readonly logger: Logger;
}

export interface RunningCatchUp {
  stop(): Promise<void>;
}

/**
 * Polls each subscription until it has applied the whole store, then again every interval. A
 * failed batch is logged and read again at the next round: its checkpoint did not move.
 */
export function startCatchUp(options: CatchUpOptions): RunningCatchUp {
  let running: Promise<void> = Promise.resolve();

  const round = async (): Promise<void> => {
    for (const subscription of options.subscriptions) {
      try {
        await subscription.catchUp();
      } catch (error) {
        options.logger.error('projection catch-up failure', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  };

  const timer = setInterval(() => {
    running = running.then(round);
  }, options.intervalMs);

  running = round();

  return {
    stop: async () => {
      clearInterval(timer);
      await running;
    },
  };
}
