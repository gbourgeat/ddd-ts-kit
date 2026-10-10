import { DEFAULT_PREFIX } from '../options/default-prefix.js';
import type { ConsumerBinding } from './consumer-binding.js';
import { deadStreamOf } from './dead-stream-of.js';
import type { StreamNames } from './stream-names.js';

/** The streams of a consumer for a type. `streamOf` is the mapping the bus was built with, the default one otherwise. */
export function streamNamesOf(
  { consumer, type }: ConsumerBinding,
  streamOf: (type: string) => string = defaultStreamOf,
): StreamNames {
  const events = streamOf(type);

  return { events, dead: deadStreamOf(events, consumer) };
}

function defaultStreamOf(type: string): string {
  return `${DEFAULT_PREFIX}:${type}`;
}
