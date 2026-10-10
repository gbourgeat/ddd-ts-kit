import { Command } from '../../../../src/index.js';
import { Public } from '../../../../src/declarations.js';

export function declareTwice(): void {
  @Public()
  @Public()
  class Twice extends Command {}

  void Twice;
}
