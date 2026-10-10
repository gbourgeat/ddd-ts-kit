import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { Retry } from '../../../../../src/decorators.js';
import { Rates } from '../../application/ports/rates.port.js';
import { FlakyRates } from './flaky-rates.js';
import { Marked } from './marked.js';

@Adapter(Rates)
@Marked()
export class DeclaredThenMarked extends FlakyRates implements Rates {
  @Retry({ attempts: 3, sleep: async () => undefined })
  async rate(_pair: string): Promise<number> {
    return this.attempt();
  }
}
