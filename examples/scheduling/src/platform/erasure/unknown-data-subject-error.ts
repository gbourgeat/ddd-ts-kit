/** An erasure asked for an id that destroyed no key and that nobody knows: a mistyped id, refused before the rebuilds. */
export class UnknownDataSubjectError extends Error {
  constructor(readonly subject: string) {
    super(`Data subject ${subject} is unknown: no key to destroy, and no person of any network has this id`);
    this.name = 'UnknownDataSubjectError';
  }
}
