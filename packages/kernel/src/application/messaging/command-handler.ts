import type { Command } from './command.js';
import type { ResultOf } from './result-of.js';

export interface CommandHandler<C extends Command<unknown>> {
  execute(command: C): Promise<ResultOf<C>>;
}
