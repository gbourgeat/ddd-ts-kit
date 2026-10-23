import type { EntitySchema } from 'typeorm';
import { outboxEntity, processedEventEntity } from '@ddd-ts-kit/typeorm';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The schema of what the kit stores for the application: the outbox and the processed events. */
export const MESSAGING_SCHEMA = 'messaging';

export const outbox = outboxEntity({ schema: MESSAGING_SCHEMA });
export const processedEvents = processedEventEntity({ schema: MESSAGING_SCHEMA });

/** Every table of the application: what the data source registers and what migrations are generated from. */
export const entities: readonly EntitySchema[] = [
  outbox,
  processedEvents,
  // ddd-ts-kit:schemas
  // /ddd-ts-kit:schemas
];
