import { indexExports } from './index-exports';
import type { IndexReading } from './index-reading';

/**
 * What the files the index re-exports whole export that the index exports under no name, each `<origin>` with the
 * kind it is: a value the index does not export as a value, a line written `export type` never
 * counting for one, and a type it exports neither as a type nor with its value.
 */
export function hiddenSymbols(reading: IndexReading): string[] {
  const exported = [...indexExports(reading).values()];
  const values = new Set(exported.flatMap(({ value }) => (value === undefined ? [] : [value])));
  const types = new Set(exported.flatMap(({ type }) => (type === undefined ? [] : [type])));
  const symbols = reading.stars.flatMap(({ symbols: held }) => held);

  return [
    ...new Set(
      symbols
        .filter(({ kind, origin }) => !(kind === 'value' ? values : types).has(origin))
        .map(({ kind, origin }) => `${origin}${kind === 'type' ? ' (a type)' : ''}`),
    ),
  ];
}
