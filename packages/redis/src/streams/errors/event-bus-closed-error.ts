export class EventBusClosedError extends Error {
  readonly code = 'EVENT_BUS_CLOSED';

  constructor() {
    super('The event bus is closed');
    this.name = 'EventBusClosedError';
  }
}
