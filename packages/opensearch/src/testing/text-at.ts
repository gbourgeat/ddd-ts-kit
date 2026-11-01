import type { Body } from './body-of';

/** The text a JSON object holds under a key, empty when it holds none. */
export function textAt(body: Body, key: string): string {
  const value = body[key];

  return typeof value === 'string' ? value : '';
}
