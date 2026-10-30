import { FactualRefusal } from '../../domain/errors/factual-refusal';

/**
 * The stream belongs to another tenant than the work in progress (or to none, when the work
 * names one): the event store refuses to read or extend it. The other tenant is not named, and
 * the answer at the edge is the one of an unknown element: the stream stays in the message, which
 * never leaves the process.
 */
export class EventStreamTenantError extends FactualRefusal {
  readonly code = 'NOT_FOUND';

  constructor(readonly stream: string) {
    super(`The stream ${stream} belongs to another tenant than the one of this work`, { stream });
  }
}
