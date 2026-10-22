import { cli, tempDir } from '../helpers';
import { jsonAt } from './json-at';

export interface InitFailure {
  readonly code: number;
  readonly message: string;
  readonly fix: string;
}

/** What `init` answers to flags it refuses: the exit code, the message and what to do instead. */
export function initFailure(...flags: readonly string[]): InitFailure {
  const result = cli(tempDir('init'), 'init', ...flags, '--json');
  const error = jsonAt(result.json(), 'error');

  return { code: result.code, message: String(jsonAt(error, 'message')), fix: String(jsonAt(error, 'fix')) };
}
