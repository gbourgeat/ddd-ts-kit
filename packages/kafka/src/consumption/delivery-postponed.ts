/**
 * Tells the client that a record was not handled: it reads the record again once the
 * partition, paused beforehand, is resumed. Its message says nothing about the event.
 */
export class DeliveryPostponed extends Error {
  readonly code = 'DELIVERY_POSTPONED';

  constructor() {
    super('The delivery is postponed');
    this.name = 'DeliveryPostponed';
  }
}
