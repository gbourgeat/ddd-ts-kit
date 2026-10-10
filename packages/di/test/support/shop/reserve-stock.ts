import type { Clock } from '@ddd-ts-kit/kernel';
import type { Stock } from './stock.port.js';

/** No decorator anywhere: the class only knows its ports. */
export class ReserveStock {
  constructor(
    readonly stock: Stock,
    readonly clock: Clock,
  ) {}

  async execute(sku: string): Promise<string> {
    await this.stock.reserve(sku);

    return `${sku}@${this.clock.now().getTime()}`;
  }
}
