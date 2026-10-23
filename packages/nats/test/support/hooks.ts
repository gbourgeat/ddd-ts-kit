import type { NatsDelivery, NatsFailure } from '../../src';

export const deliveriesOf = (settled: NatsDelivery[]) => (delivery: NatsDelivery) => void settled.push(delivery);

export const failuresOf = (reported: NatsFailure[]) => (failure: NatsFailure) => void reported.push(failure);
