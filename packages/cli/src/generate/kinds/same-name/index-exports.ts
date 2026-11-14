import type { IndexReading } from './index-reading';
import { signatureOf } from './signature-of';
import { type Bound, symbolOf } from './symbol-of';

/**
 * What a schema index exports under each name, as the compiler resolves it, each by the place that
 * declares it. A name the index declares or exports by name is that and nothing else: it shadows
 * what the `export *` lines bring under it, a line written `export type` giving it no value at
 * all. A name the `export *` lines alone bring is exported when every file that holds it holds the
 * same symbol; several symbols under one name are exported by none.
 */
export function indexExports(reading: IndexReading): Map<string, Bound> {
  const exported = new Map<string, Bound>();
  const join = (name: string, bound: Bound): void => void exported.set(name, { ...exported.get(name), ...bound });

  reading.values.forEach((name) => join(name, { value: `${reading.index}#${name}` }));
  reading.types.forEach((name) => join(name, { type: `${reading.index}#${name}` }));

  for (const { local, value, type } of reading.given) {
    join(local, { ...(value === undefined ? {} : { value }), ...(type === undefined ? {} : { type }) });
  }

  const explicit = new Set(exported.keys());

  for (const name of new Set(reading.stars.flatMap(({ symbols }) => symbols.map((symbol) => symbol.name)))) {
    const held = reading.stars.map((star) => symbolOf(star, name)).filter((bound) => signatureOf(bound) !== '|');

    if (!explicit.has(name) && new Set(held.map(signatureOf)).size === 1) {
      exported.set(name, held[0] ?? {});
    }
  }

  return exported;
}
