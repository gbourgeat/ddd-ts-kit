import type { RawHeaders } from './raw-headers.js';

/** One header as a string, the first of a repeated one, `''` when absent. */
export function headerOf(headers: RawHeaders, name: string): string {
  const value = headers[name];

  return (Array.isArray(value) ? value[0] : value) ?? '';
}
