import type { Command } from './command';
import type { ResultOf } from './result-of';

export interface CommandHandler<C extends Command<unknown>> {
  execute(command: C): Promise<ResultOf<C>>;
}
