import { Command } from '@ddd-ts-kit/kernel';

export class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}
