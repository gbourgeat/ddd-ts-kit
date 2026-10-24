/** An erasure asked for a subject that is not an opaque identifier: refused before any key is touched or any entry written. The value is not repeated, it may be personal. */
export class NotADataSubjectIdError extends Error {
  constructor() {
    super(
      'A data subject is an opaque identifier (letters, digits, "_" and "-", 63 at most), never a name or an email',
    );

    this.name = 'NotADataSubjectIdError';
  }
}
