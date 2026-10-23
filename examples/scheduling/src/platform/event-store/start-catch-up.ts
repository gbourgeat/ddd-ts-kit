import { ConcurrencyError, type CatchUpSubscription, type Logger } from '@ddd-ts-kit/kernel';

export interface CatchUpOptions {
  readonly subscriptions: readonly CatchUpSubscription[];
  readonly intervalMs: number;
  readonly logger: Logger;
}

export interface RunningCatchUp {
  stop(): Promise<void>;
}

/**
 * Polls each subscription until it has applied the whole store, then again every interval; a
 * tick that comes while a round is still running is skipped, so rounds never pile up. A failed
 * batch is logged and read again at the next round: its checkpoint did not move. A batch refused
 * because another process moved the checkpoint first is no failure: with several replicas, one
 * of them applies each batch.
 */
export function startCatchUp(options: CatchUpOptions): RunningCatchUp {
  let running: Promise<void> | undefined;

  const tick = (): void => {
    running ??= catchUpAll(options).finally(() => {
      running = undefined;
    });
  };

  const timer = setInterval(tick, options.intervalMs);

  tick();

  return {
    stop: async () => {
      clearInterval(timer);
      await running;
    },
  };
}

async function catchUpAll({ subscriptions, logger }: CatchUpOptions): Promise<void> {
  for (const subscription of subscriptions) {
    try {
      await subscription.catchUp();
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        logger.debug('projection catch-up skipped: another process moved the checkpoint first');
      } else {
        logger.error('projection catch-up failure', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }
}
