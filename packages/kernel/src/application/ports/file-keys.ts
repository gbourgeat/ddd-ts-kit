/**
 * Names the files: a key is always generated on the server, never built from what a user sent
 * (a file name, a path), so a request can neither choose where it writes nor guess another key.
 */
export abstract class FileKeys {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.FileKeys' });
  }

  /** A new key under `area`, a key prefix of the project such as `appointment-documents`. */
  abstract next(area: string): string;
}
