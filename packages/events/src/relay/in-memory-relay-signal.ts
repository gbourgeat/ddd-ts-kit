import type { RelaySignal } from './relay-signal';

export class InMemoryRelaySignal implements RelaySignal {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): { unsubscribe(): void } {
    this.listeners.add(listener);

    return { unsubscribe: () => void this.listeners.delete(listener) };
  }

  notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
