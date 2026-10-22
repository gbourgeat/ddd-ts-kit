import { SlowGateway } from './slow-gateway';
import { Unreachable } from './unreachable';

/** A slow gateway with one method that always fails and one that always answers. */
export class FlakyGateway extends SlowGateway {
  async fail(): Promise<never> {
    throw new Unreachable();
  }

  override async ping(): Promise<string> {
    return 'pong';
  }
}
