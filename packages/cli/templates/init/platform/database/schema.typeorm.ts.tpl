import type { EntitySchema } from 'typeorm';
import { eventStoreEntities, outboxEntity, processedEventEntity } from '@ddd-ts-kit/typeorm';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The schema of what the kit stores for the application: the outbox and the processed events. */
export const MESSAGING_SCHEMA = 'messaging';

export const outbox = outboxEntity({ schema: MESSAGING_SCHEMA });
export const processedEvents = processedEventEntity({ schema: MESSAGING_SCHEMA });

/** The schema of the event store: the events, the snapshots, the checkpoints and the keys of the data subjects. It records no tenant. */
export const EVENT_STORE_SCHEMA = 'event_store';

/** The five tables of the event store, registered with the data source and migrated like the others. */
export const eventStore = eventStoreEntities({ schema: EVENT_STORE_SCHEMA });

/** Every table of the application: what the data source registers and what migrations are generated from. */
export const entities: readonly EntitySchema[] = [
  outbox,
  processedEvents,
  ...eventStore,
  // ddd-ts-kit:schemas
  // /ddd-ts-kit:schemas
];
