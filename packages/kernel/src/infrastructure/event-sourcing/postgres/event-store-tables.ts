/** The names of the tables of an event store, fixed: a context that keeps one gives it a schema of its own. */
export const EVENT_STORE_TABLES = {
  events: 'stored_events',
  head: 'stored_events_head',
  snapshots: 'stream_snapshots',
  checkpoints: 'subscription_checkpoints',
  subjectKeys: 'subject_keys',
} as const;
