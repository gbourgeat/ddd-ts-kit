import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { CustomerOrders, customerOrdersCriteria, type CustomerOrdersRow } from '../../application/ports/customer-orders.port.js';

@Adapter(CustomerOrders)
export class InMemoryCustomerOrders extends InMemoryReadModelStore<CustomerOrdersRow> implements CustomerOrders {
  constructor() {
    super(customerOrdersCriteria);
  }
}
