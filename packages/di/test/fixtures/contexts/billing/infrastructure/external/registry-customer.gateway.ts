import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { CUSTOMERS, type CustomerDirectory } from '../../application/ports/billing.ports.js';

@Gateway(CUSTOMERS)
export class RegistryCustomerGateway implements CustomerDirectory {
  async exists(customerId: string): Promise<boolean> {
    return customerId.startsWith('customer-');
  }
}
