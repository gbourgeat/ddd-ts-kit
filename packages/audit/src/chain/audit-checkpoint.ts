/** A position of a chain and the hash it had there, to publish where the store cannot write. */
export interface AuditCheckpoint {
  readonly chain: string;
  readonly sequence: number;
  readonly hash: string;
}
