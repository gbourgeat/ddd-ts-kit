/** What a database driver throws: a short code, and a message quoting the row it choked on. */
export class UniqueViolation extends Error {
  readonly code = '23505';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UniqueViolation';
  }
}
