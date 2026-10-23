import type { RabbitMqDelivery, RabbitMqFailure } from '../../src';

export const deliveriesOf = (settled: RabbitMqDelivery[]) => (delivery: RabbitMqDelivery) =>
  void settled.push(delivery);

export const failuresOf = (reported: RabbitMqFailure[]) => (failure: RabbitMqFailure) => void reported.push(failure);
