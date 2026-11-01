/** A refusal of a mapping or a document, as the node types it. */
export class FakeRefusal extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    reason: string,
  ) {
    super(reason);
  }
}
