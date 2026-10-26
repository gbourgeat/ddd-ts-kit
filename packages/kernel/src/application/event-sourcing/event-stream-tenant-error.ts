/**
 * The stream belongs to another tenant than the work in progress (or to none, when the work
 * names one): the event store refuses to read or extend it. The other tenant is not named.
 */
export class EventStreamTenantError extends Error {
  constructor(readonly stream: string) {
    super(`The stream ${stream} belongs to another tenant than the one of this work`);
    this.name = 'EventStreamTenantError';
  }
}
