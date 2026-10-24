import { isRate } from './is-rate';
import type { Mutation } from './mutation';
import type { MUTATION_LAYERS } from './mutation-layers';
import { REFERENCE_MUTATION } from './reference-mutation';
import { isRecord } from './values/is-record';

/** Tolerant like the rest of the config: a score that is not a percentage is read as the reference, and `check` says so. */
export function parseMutation(value: unknown): Mutation {
  const raw = isRecord(value) ? value : {};

  return {
    domain: floorOf(raw, 'domain'),
    application: floorOf(raw, 'application'),
  };
}

function floorOf(raw: Record<string, unknown>, layer: (typeof MUTATION_LAYERS)[number]): number {
  const written = raw[layer];

  return isRate(written) ? written : REFERENCE_MUTATION[layer];
}
