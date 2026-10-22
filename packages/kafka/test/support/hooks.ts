import type { KafkaDelivery, KafkaFailure } from '../../src';

export const deliveriesOf = (settled: KafkaDelivery[]) => (delivery: KafkaDelivery) => void settled.push(delivery);

export const failuresOf = (reported: KafkaFailure[]) => (failure: KafkaFailure) => void reported.push(failure);
