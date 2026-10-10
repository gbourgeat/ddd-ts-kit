import { BrokerUnavailableError } from './broker-unavailable-error.js';

/** Rejects with `BROKER_UNAVAILABLE` when `work` has not settled after `timeoutMs`. */
export async function within<T>(work: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new BrokerUnavailableError(reason));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}
