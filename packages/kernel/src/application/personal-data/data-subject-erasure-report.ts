/** What an erasure did: whether the subject had a key, the rows each copy reached in every tenant, and the events each projection replayed. */
export interface DataSubjectErasureReport {
  readonly erased: boolean;
  readonly copies: Readonly<Record<string, number>>;
  readonly rebuilt: Readonly<Record<string, number>>;
}
