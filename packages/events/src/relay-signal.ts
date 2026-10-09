/**
 * How a store tells a relay that records were appended, so the relay can sleep on a long
 * interval and still publish at once: PostgreSQL `LISTEN/NOTIFY`, a change stream, or
 * `InMemoryRelaySignal` in a single process.
 *
 * A signal is a hint, never a delivery guarantee: a notification may be lost (connection
 * dropped, process restarting), which must only delay the publication until the next poll.
 */
export interface RelaySignal {
  subscribe(listener: () => void): { unsubscribe(): void };
}

export class InMemoryRelaySignal implements RelaySignal {
  readonly #listeners = new Set<() => void>();

  subscribe(listener: () => void): { unsubscribe(): void } {
    this.#listeners.add(listener);
    return { unsubscribe: () => void this.#listeners.delete(listener) };
  }

  notify(): void {
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }
}
