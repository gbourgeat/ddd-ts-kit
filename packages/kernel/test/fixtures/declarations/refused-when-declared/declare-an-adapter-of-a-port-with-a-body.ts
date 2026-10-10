import { Adapter } from '../../../../src/declarations.js';
import { TalkativePharmacy } from '../contexts/clinic/application/ports/talkative-pharmacy.port.js';

export function declareAnAdapterOfAPortWithABody(): void {
  @Adapter(TalkativePharmacy)
  class CornerPharmacy implements TalkativePharmacy {
    async dispense(): Promise<void> {}

    greet(): string {
      return 'good morning';
    }
  }

  void CornerPharmacy;
}
