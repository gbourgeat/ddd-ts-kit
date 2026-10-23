import { Command } from '../../../../src';
import { Public } from '../../../../src/declarations';

export function declareTwice(): void {
  @Public()
  @Public()
  class Twice extends Command {}

  void Twice;
}
