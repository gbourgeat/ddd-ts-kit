import type { StoredData } from './stored-data';

/** An event as the store is handed it: serialized, not yet placed in its stream. */
export interface EventToAppend {
  /** Unique in the store. */
  readonly id: string;
  /** The name the domain event carries, `<context>.<aggregate>.<fact>`. */
  readonly type: string;
  /** The version of the shape of `data`; a stored event is never rewritten, it is upcast when read. */
  readonly schemaVersion: number;
  readonly data: StoredData;
  /** What is not the fact itself: correlation, causation, actor. */
  readonly metadata?: StoredData;
  readonly occurredAt: Date;
}
