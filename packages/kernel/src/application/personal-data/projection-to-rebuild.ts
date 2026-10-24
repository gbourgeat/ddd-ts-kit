/** A projection fed by the event store, rebuilt from position zero after an erasure so that no read model keeps a clear copy of what the key sealed. */
export interface ProjectionToRebuild {
  readonly name: string;

  rebuild(): Promise<{ readonly replayed: number }>;
}
