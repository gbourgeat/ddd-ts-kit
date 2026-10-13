import { isRecord } from '../config/values/is-record.js';

/** The alternatives of a security requirement, each the names of the schemes it sends together; none: public. */
export function readSecurity(value: unknown): string[][] {
  const requirements: unknown[] = Array.isArray(value) ? value : [];

  return requirements.filter(isRecord).map((requirement) => Object.keys(requirement));
}
