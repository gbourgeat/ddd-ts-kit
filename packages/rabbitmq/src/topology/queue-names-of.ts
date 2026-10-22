import type { ConsumerBinding } from './consumer-binding';
import type { QueueNames } from './queue-names';

export function queueNamesOf({ consumer, type }: ConsumerBinding): QueueNames {
  const work = `${consumer}.${type}`;

  return { work, retry: `${work}.retry`, dead: `${work}.dead` };
}
