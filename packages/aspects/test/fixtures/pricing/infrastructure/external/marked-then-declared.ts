import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { Retry } from '../../../../../src/decorators.js';
import { SpotRates } from '../../application/ports/spot-rates.port.js';
import { FlakyRates } from './flaky-rates.js';
import { Marked } from './marked.js';
import { noting } from './noting.js';

@Marked()
@Adapter(SpotRates, { aspects: [noting] })
export class MarkedThenDeclared extends FlakyRates implements SpotRates {
  @Retry({ attempts: 3, sleep: async () => undefined })
  async rate(_pair: string): Promise<number> {
    return this.attempt();
  }
}
