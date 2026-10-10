import { Command } from '@ddd-ts-kit/kernel';

export class CancelOrder extends Command {
  constructor(readonly orderId: string) {
    super();
  }
}
