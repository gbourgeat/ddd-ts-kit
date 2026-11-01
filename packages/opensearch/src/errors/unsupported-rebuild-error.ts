/**
 * `ProjectionRebuild` was given an OpenSearch read model: its rebuild is not built yet. The names
 * keep it open (each index carries a generation, every read goes through an alias), so a later
 * version fills the next generation and moves the alias in one step.
 */
export class UnsupportedRebuildError extends Error {
  readonly code = 'UNSUPPORTED_REBUILD';

  constructor(readonly step: string) {
    super(`The OpenSearch read model has no rebuild yet (${step})`);
    this.name = 'UnsupportedRebuildError';
  }
}
