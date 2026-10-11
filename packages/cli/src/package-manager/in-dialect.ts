import type { Stack } from '../config/index.js';
import { DIALECTS } from './dialects.js';

/**
 * A text written for npm, as the package manager of the project says it: the commands of a
 * script, of a pipeline, of a hook, of a Dockerfile and of the guidance. Translating twice
 * changes nothing, and npm is left as it is.
 */
export function inDialect(text: string, manager: Stack['packageManager']): string {
  return DIALECTS[manager].reduce((translated, [npm, own]) => translated.replace(npm, own), text);
}
