import type { AllowedFile } from './config';
import { posix } from './posix';
import { isRecord } from './is-record';

/** An entry without a file or without a reason allows nothing: `ddd-ts-kit check` reports it as `config/valid`. */
export function parseAllowedFile(value: unknown): AllowedFile[] {
  if (!isRecord(value) || typeof value['file'] !== 'string' || typeof value['reason'] !== 'string') {
    return [];
  }

  const allowed = { file: posix(value['file']), reason: value['reason'].trim() };

  return allowed.file === '' || allowed.reason === '' ? [] : [allowed];
}
