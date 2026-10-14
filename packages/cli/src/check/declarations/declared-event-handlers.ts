import type { Scan } from '../scan/scan.js';
import { argumentsOf } from './arguments-of.js';
import { classesOf } from './classes-of.js';
import { optionOf, type OptionValue } from './option-of.js';

export interface DeclaredEventHandler {
  readonly className: string;
  /** Line of the decorator. */
  readonly line: number;
  /** The first argument: the definition of the integration event. */
  readonly event: string;
  /** The `consumer` of `@IntegrationEventHandler`; undefined when the options hold no such key. */
  readonly name: OptionValue | undefined;
}

const DECORATOR = 'IntegrationEventHandler';

/** The classes of a source that declare themselves handlers of an integration event, with the consumer name their decorator gives. */
export function declaredEventHandlers(scan: Scan): DeclaredEventHandler[] {
  return classesOf(scan).flatMap((declared) =>
    declared.decorations
      .filter(({ name }) => name === DECORATOR)
      .map((decoration) => ({
        className: declared.name,
        line: decoration.line,
        event: argumentsOf(scan, decoration)[0]?.code ?? '',
        name: optionOf(scan, decoration, 'consumer'),
      })),
  );
}
