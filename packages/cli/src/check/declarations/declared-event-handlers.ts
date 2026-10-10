import type { Scan } from '../scan/scan.js';
import { argumentsOf } from './arguments-of.js';
import { classesOf } from './classes-of.js';
import { optionOf, type OptionValue } from './option-of.js';

export interface DeclaredEventHandler {
  readonly className: string;
  /** Line of the decorator. */
  readonly line: number;
  /** The first argument: the definition of an integration event, or the class of a domain event. */
  readonly event: string;
  /** The `consumer` of `@IntegrationEventHandler` or the `name` of `@DomainEventHandler`; undefined when the options hold no such key. */
  readonly name: OptionValue | undefined;
}

const NAME_KEYS = { IntegrationEventHandler: 'consumer', DomainEventHandler: 'name' } as const;

/** The classes of a source that declare themselves handlers of an event, with the name their decorator gives. */
export function declaredEventHandlers(scan: Scan, decorator: keyof typeof NAME_KEYS): DeclaredEventHandler[] {
  return classesOf(scan).flatMap((declared) =>
    declared.decorations
      .filter(({ name }) => name === decorator)
      .map((decoration) => ({
        className: declared.name,
        line: decoration.line,
        event: argumentsOf(scan, decoration)[0]?.code ?? '',
        name: optionOf(scan, decoration, NAME_KEYS[decorator]),
      })),
  );
}
