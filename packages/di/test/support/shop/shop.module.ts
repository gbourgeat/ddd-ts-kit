import { Clock } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src/index.js';
import { InMemoryStock } from './in-memory-stock.js';
import { ReserveStock } from './reserve-stock.js';
import { Stock } from './stock.port.js';

export const shop = defineContextModule({
  name: 'shop',
  register(builder) {
    builder.bind(Stock).toClass(InMemoryStock).as('repository');
    builder.bind(ReserveStock).toClass(ReserveStock, [Stock, Clock]).as('use-case');
  },
});
