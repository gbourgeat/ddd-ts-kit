import type { OnePerFile, OnePerFileAllowance } from './config.js';
import { isRecord } from './values/is-record.js';
import { posix } from './values/posix.js';
import { text } from './values/text.js';

/** An entry without a file or without a reason allows nothing: `config/valid` reports it. */
export function parseOnePerFile(value: unknown): OnePerFile {
  const raw = isRecord(value) ? value : {};
  const entries: unknown[] = Array.isArray(raw['allow']) ? raw['allow'] : [];

  return { allow: entries.map(parseAllowance).filter((allowance) => allowance.file !== '' && allowance.reason !== '') };
}

function parseAllowance(value: unknown): OnePerFileAllowance {
  const raw = isRecord(value) ? value : {};

  return { file: posix(text(raw['file'], '')), reason: text(raw['reason'], '').trim() };
}
