import type { CiConfig } from './config.js';
import { isRecord } from './values/is-record.js';
import { strings } from './values/strings.js';

/** Tolerant: an unknown extra is kept as written, and `config/valid` reports it. */
export function parseCi(value: unknown): CiConfig {
  return { extras: isRecord(value) ? strings(value['extras'], []) : [] };
}
