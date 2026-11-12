/**
 * An event changes a row the read model does not hold: `updateIfNewer` found nothing under the
 * key, or the trace of a deletion older than the event. In both cases the event that creates the
 * row comes before this one in the history and has not been applied yet, so nothing is written
 * and the event is thrown back: the consumer fails, its processed mark is rolled back, and the
 * provider delivers the event again, after the creation if it arrived meanwhile. An ordinary
 * failure for every provider: retried, then dead-lettered when the creation never comes.
 */
export class RowNotHeldError extends Error {
  constructor(readonly key: string) {
    super(
      `The read model holds no row under the key "${key}" for this event to change: the event that creates the row has not been applied yet. The event is refused so that it is delivered again after it. When no event creates the row first, write it with upsertIfNewer`,
    );

    this.name = 'RowNotHeldError';
  }
}
