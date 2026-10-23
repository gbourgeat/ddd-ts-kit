import { isRecord } from './is-record';

export function mapEntries<T>(value: unknown, parse: (entry: unknown) => T): Record<string, T> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, parse(entry)])) : {};
}
