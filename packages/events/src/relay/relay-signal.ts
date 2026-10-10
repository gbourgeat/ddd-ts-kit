/**
 * How a store tells a relay that records were appended, so the relay can sleep on a long
 * interval and still publish at once: PostgreSQL `LISTEN/NOTIFY`, a change stream, or
 * `InMemoryRelaySignal` in a single process.
 *
 * A signal is a hint, never a delivery guarantee: a notification may be lost (connection
 * dropped, process restarting), which must only delay the publication until the next poll.
 */
export abstract class RelaySignal {
  static readonly tokenKey = 'events.RelaySignal';

  abstract subscribe(listener: () => void): { unsubscribe(): void };
}
