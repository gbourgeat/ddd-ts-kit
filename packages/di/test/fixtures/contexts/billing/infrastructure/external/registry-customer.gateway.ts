import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { CustomerDirectory } from '../../application/ports/customer-directory.port';

@Gateway(CustomerDirectory)
export class RegistryCustomerGateway implements CustomerDirectory {
  async exists(customerId: string): Promise<boolean> {
    return customerId.startsWith('customer-');
  }
}
