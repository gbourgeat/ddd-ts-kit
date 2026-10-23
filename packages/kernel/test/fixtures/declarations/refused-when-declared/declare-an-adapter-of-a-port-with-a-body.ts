import { Adapter } from '../../../../src/declarations';
import { TalkativePharmacy } from '../contexts/clinic/application/ports/talkative-pharmacy.port';

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
