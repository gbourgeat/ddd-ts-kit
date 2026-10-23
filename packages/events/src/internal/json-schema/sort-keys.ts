import { compareText } from './compare-text';

export function sortKeys<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => compareText(a, b)));
}
