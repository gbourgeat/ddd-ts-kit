import { DATABASE_STACKS, ORM_STACKS } from '../../config';
import { CliError } from '../../cli-error';
import { WITH_DATABASE } from '../../stack/with-database';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

const EVENT_CHOICES = ['in-memory', 'outbox'] as const;

interface Persistence {
  readonly orm: string;
  readonly database: string;
  readonly events: string;
}

/** The generated persistence is written for PostgreSQL, the dialect every adapter package tests. `custom` and `none` bring their own storage, or none. */
export function resolvePersistence(options: StackOptions): Persistence {
  const requested = choose(DATABASE_STACKS, options.database, 'database');
  const orm = choose(ORM_STACKS, options.orm, 'orm') ?? (requested === 'none' ? 'none' : 'drizzle');
  const needsPostgres = WITH_DATABASE.includes(orm);
  const database = requested ?? (needsPostgres ? 'postgres' : 'none');

  if (needsPostgres && database !== 'postgres') {
    throw new CliError(
      `--orm ${orm} cannot be combined with --database ${database}.`,
      `With ${orm}, use --database postgres: the generated adapters are written for it. Pick --orm custom to bring your own for another database.`,
    );
  }

  const events = choose(EVENT_CHOICES, options.events, 'events') ?? (orm === 'none' ? 'in-memory' : 'outbox');

  assertOutboxWithDatabase({ orm, events }, options.allowNoOutbox);

  return { orm, database, events };
}

/** docs/ARCHITECTURE.md, `events/outbox-required`: leaving the outbox out with a database is a recorded deviation, never a default. */
function assertOutboxWithDatabase(stack: { orm: string; events: string }, reason: string | undefined): void {
  if (stack.orm === 'none' || stack.events === 'outbox' || (reason !== undefined && reason.trim() !== '')) {
    return;
  }

  throw new CliError(
    `--events ${stack.events} cannot be combined with --orm ${stack.orm}.`,
    'With a database, integration events leave through the transactional outbox, or a state change and its event can part ways. Drop --events, or record the decision with --allow-no-outbox "<reason>": it writes a deviation entry and an ADR stub.',
  );
}
