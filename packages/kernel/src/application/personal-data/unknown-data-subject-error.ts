/** An erasure asked for an id that destroyed no key, erased no row and that nobody knows: a mistyped id, or an erasure already complete, refused before the rebuilds. */
export class UnknownDataSubjectError extends Error {
  constructor(readonly subject: string) {
    super(
      `Data subject ${subject} is unknown: no key to destroy, no copy to erase in any tenant, and nobody knows this id. A mistyped id, or an erasure already complete: the audit trail says which`,
    );

    this.name = 'UnknownDataSubjectError';
  }
}
