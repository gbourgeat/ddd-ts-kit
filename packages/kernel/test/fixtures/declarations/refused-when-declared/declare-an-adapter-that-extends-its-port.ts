import { Adapter } from '../../../../src/declarations';
import { Pharmacy } from '../contexts/clinic/application/ports/pharmacy.port';

export function declareAnAdapterThatExtendsItsPort(): void {
  @Adapter(Pharmacy)
  class CornerPharmacy extends Pharmacy {
    async dispense(): Promise<void> {}
  }

  void CornerPharmacy;
}
