import { isRate } from './is-rate';
import type { Mutation } from './mutation';
import { REFERENCE_MUTATION } from './reference-mutation';
import { isRecord } from './values/is-record';

/** Tolerant like the rest of the config: a score that is not a percentage is read as the reference, and `check` says so. */
export function parseMutation(value: unknown): Mutation {
  const raw = isRecord(value) ? value : {};
  const domain = raw['domain'];

  return { domain: isRate(domain) ? domain : REFERENCE_MUTATION.domain };
}
