import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { ignore } from '../ignore.js';
import { DeliveryPostponed } from './delivery-postponed.js';

type Delivery = KafkaJS.EachMessagePayload;

/**
 * Pauses the partition of the record and hands `release` the way to resume it. Throwing is
 * how the client is told to read the record again instead of moving to the next one.
 */
export function postpone(delivery: Delivery, release: (resume: () => void) => void): never {
  release(quietly(pausing(delivery)));
  throw new DeliveryPostponed();
}

// Pausing or resuming a partition the group took back throws: the new owner reads the record.
function pausing(delivery: Delivery): () => void {
  try {
    return delivery.pause();
  } catch {
    return ignore;
  }
}

function quietly(act: () => void): () => void {
  return () => {
    try {
      act();
    } catch {
      return;
    }
  };
}
