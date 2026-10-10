import { Adapter } from '../../../../src/declarations.js';
import { Pharmacy } from '../contexts/clinic/application/ports/pharmacy.port.js';

export function declareAnAdapterThatExtendsItsPort(): void {
  @Adapter(Pharmacy)
  class CornerPharmacy extends Pharmacy {
    async dispense(): Promise<void> {}
  }

  void CornerPharmacy;
}
