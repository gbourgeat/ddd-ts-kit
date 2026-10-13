const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const MAX_KEY_LENGTH = 1_024;

/**
 * Whether a key is one the storages accept: segments separated by `/`, each made of letters,
 * digits, dots, hyphens and underscores and none starting with a dot, so a key can never climb
 * out of its directory or prefix (`..`), be absolute, or hide a file.
 */
export function isFileKey(key: string): boolean {
  return key.length > 0 && key.length <= MAX_KEY_LENGTH && key.split('/').every((segment) => SEGMENT.test(segment));
}
