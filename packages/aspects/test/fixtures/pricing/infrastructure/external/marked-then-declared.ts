import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { Retry } from '../../../../../src/decorators';
import { SpotRates } from '../../application/ports/spot-rates.port';
import { FlakyRates } from './flaky-rates';
import { Marked } from './marked';
import { noting } from './noting';

@Marked()
@Adapter(SpotRates, { aspects: [noting] })
export class MarkedThenDeclared extends FlakyRates implements SpotRates {
  @Retry({ attempts: 3, sleep: async () => undefined })
  async rate(_pair: string): Promise<number> {
    return this.attempt();
  }
}
