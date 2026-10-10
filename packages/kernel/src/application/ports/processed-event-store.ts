/** Idempotency guard: at-least-once delivery is the rule, so every consumer needs one. */
export abstract class ProcessedEventStore {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.ProcessedEventStore' });
  }

  /** Returns true the first time `(consumer, eventId)` is seen, false afterwards. */
  abstract markProcessed(consumer: string, eventId: string): Promise<boolean>;

  /**
   * Forgets a mark taken by a delivery whose handler then failed, so the redelivery is
   * handled. Stores whose mark shares the handler's transaction do not need it: the
   * rollback already removes the mark.
   */
  abstract release?(consumer: string, eventId: string): Promise<void>;
}
