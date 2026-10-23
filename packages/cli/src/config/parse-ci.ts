import type { CiConfig } from './config';
import { isRecord } from './values/is-record';
import { strings } from './values/strings';

/** Tolerant: an unknown extra is kept as written, and `config/valid` reports it. */
export function parseCi(value: unknown): CiConfig {
  return { extras: isRecord(value) ? strings(value['extras'], []) : [] };
}
