import type { FakeProperty } from './properties-of';

/** The type the mapping gives a dotted path: `keyword` for a path it does not know. */
export function typeAt(properties: Readonly<Record<string, FakeProperty>>, path: string): string {
  const [name = '', ...rest] = path.split('.');
  const property = properties[name];

  if (rest.length === 0 || property?.properties === undefined) {
    return property?.type ?? 'keyword';
  }

  return typeAt(property.properties, rest.join('.'));
}
