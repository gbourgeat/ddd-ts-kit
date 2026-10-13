/** The state of an event-sourced aggregate as it stood after `version` events of its stream. */
export interface AggregateSnapshot<S> {
  readonly version: number;
  readonly state: S;
}
