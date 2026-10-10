export class ConsumerNameRequiredError extends Error {
  readonly code = 'CONSUMER_NAME_REQUIRED';

  constructor() {
    super(
      'Subscribing needs a consumer name: build the bus with `consumer`, or use `forConsumer(name)`',
    );

    this.name = 'ConsumerNameRequiredError';
  }
}
