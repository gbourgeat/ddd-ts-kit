import { CliError } from '../../cli-error';
import type { Config } from '../../config';

/** `--allow-no-outbox` records a deviation that exists only with a database and `--events in-memory`: on any other stack it would be dropped without a word. */
export function refuseUnusedNoOutbox(reason: string | undefined, stack: Pick<Config['stack'], 'orm' | 'events'>): void {
  if ((reason ?? '').trim() === '' || (stack.orm !== 'none' && stack.events !== 'outbox')) {
    return;
  }

  throw new CliError(
    `--allow-no-outbox records nothing on this stack (--orm ${stack.orm}, --events ${stack.events}).`,
    'It is the reason for leaving the outbox out with a database: add --events in-memory with an ORM, or drop --allow-no-outbox.',
  );
}
