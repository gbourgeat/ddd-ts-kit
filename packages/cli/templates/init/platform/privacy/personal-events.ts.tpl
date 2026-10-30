import type { PersonalEvent } from '@ddd-ts-kit/events';

/**
 * The integration events that carry personal data, as the `personal` option of each one declares it:
 * what an erasure looks for in the records of the outbox. Written by `ddd-ts-kit docs`, like the
 * register, and held to the declarations by `docs --check`.
 */
export const personalEvents: readonly PersonalEvent[] = [
  // ddd-ts-kit:personal-events
  // /ddd-ts-kit:personal-events
];
