import type { StreamStorage } from '../options/stream-storage.js';

export interface StreamDescription {
  readonly name: string;
  /** `events` keeps what is published, `dead` keeps what a consumer gave up on. */
  readonly role: 'events' | 'dead';
  readonly subjects: readonly string[];
  readonly storage: StreamStorage;
  readonly replicas: number;
  readonly duplicateWindowMs: number;
}
