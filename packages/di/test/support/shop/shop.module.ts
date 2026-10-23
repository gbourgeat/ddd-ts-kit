import { Clock } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src';
import { InMemoryStock } from './in-memory-stock';
import { ReserveStock } from './reserve-stock';
import { Stock } from './stock.port';

export const shop = defineContextModule({
  name: 'shop',
  register(builder) {
    builder.bind(Stock).toClass(InMemoryStock).as('repository');
    builder.bind(ReserveStock).toClass(ReserveStock, [Stock, Clock]).as('use-case');
  },
});
