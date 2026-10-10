import { InMemoryDomainEventDispatcher, dispatchingOnSave, type DomainEvent } from '../../../src/index.js';
import { InMemoryCarts } from './in-memory-carts.js';

export interface Bench {
  readonly dispatcher: InMemoryDomainEventDispatcher;
  readonly carts: InMemoryCarts;
  /** Names of the events dispatched so far, in order. */
  readonly heard: string[];
  /** Listens to the listed events and notes each one. */
  hear(...names: string[]): void;
}

/** A repository whose saves dispatch to a dispatcher that notes what it hears. */
export function aBench(): Bench {
  const dispatcher = new InMemoryDomainEventDispatcher();
  const heard: string[] = [];
  const note = async (event: DomainEvent): Promise<void> => void heard.push(event.name);

  return {
    dispatcher,
    carts: dispatchingOnSave(new InMemoryCarts(), () => dispatcher),
    heard,
    hear: (...names) => {
      for (const name of names) {
        dispatcher.on(name, note);
      }
    },
  };
}
