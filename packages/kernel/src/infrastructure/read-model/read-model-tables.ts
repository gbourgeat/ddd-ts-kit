import type { Logger } from '../../application/ports/logger';
import { databaseFailure } from './database-failure';
import { ReadModelTableNotReadyError } from './read-model-table-not-ready-error';
import { readModelTableNotes } from './read-model-table-notes';
import { readModelTableReady } from './read-model-table-ready';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';
import { ReadModelTablesNotReadyError } from './read-model-tables-not-ready-error';

/** A read model as an application lists it: its store, or the table under it, which reads what that table can hold. */
export interface ReadModelInATable {
  /** Absent, or `undefined`, where the rows are not kept in a table: such a read model has nothing to check. */
  tableState?(): Promise<ReadModelTableState | undefined>;
}

/** One entry of the list: the name a failure is told under, and how the store is built, as the application binds it. */
export interface ListedReadModel {
  readonly name: string;
  /** The bounded context the read model belongs to, when the application hosts several: what `hosting` selects by. */
  readonly context?: string;
  build(): ReadModelInATable;
}

/**
 * What an application does at its start with the listed tables that are not ready or could not
 * be read: `required` refuses to start, `reported` logs them as one error and starts, for a
 * deployment that starts the application before its migrations ran.
 */
export type ReadModelTablesAtStart = 'required' | 'reported';

/** What a check of the listed tables found, as a command says it. */
export interface ReadModelTablesReport {
  readonly ready: boolean;
  /** `unread` when no listed table could be read and one failed: the database does not answer, or refuses the reading. */
  readonly outcome: 'ready' | 'not-ready' | 'unread';
  readonly text: string;
}

type Unread = ReadModelTablesNotReadyError['unread'][number];

interface Reading {
  readonly states: readonly ReadModelTableState[];
  readonly unread: readonly Unread[];
  /** The entry at which the database could not be reached: nothing was asked of it after that one. */
  readonly unreached?: Unread;
}

/**
 * The read model tables an application declares, checked in one pass before a request or an
 * event reaches a store, whenever the stores themselves are built. Each entry builds the store of
 * one read model, the class the application binds, with its own options: the table is then read
 * by the code that store runs before its first trace, so the verdict is the store's and the
 * migration names its columns. Every entry is tried: a store whose definition refuses its table
 * is reported like the others, and one that cannot be built or read (a role without the right to
 * read its schema) is told under its name with what failed, the others still read. Nothing is
 * guessed from the database: a table that is not listed is not read, and an empty list checks
 * nothing. `unlisted` names the read model stores the application knows it does not list: they
 * are told as a warning, since nothing checks them. A database that cannot be reached (a refused
 * connection, a host that is not found, a timeout) is no answer about a table: the reading stops
 * there, a start goes on with one warning, since it never depended on the database being up, and
 * a command says the database could not be read.
 */
export class ReadModelTables {
  constructor(
    private readonly listed: readonly ListedReadModel[],
    private readonly unlisted: readonly string[] = [],
  ) {}

  /** The contexts the entries belong to, each once, in the order of the list: what a command names when it is asked for one the list does not hold. */
  get contexts(): readonly string[] {
    return [...new Set(this.listed.flatMap(({ context }) => (context === undefined ? [] : [context])))];
  }

  /**
   * The entries of these contexts alone, for an application that hosts some of them; every entry
   * when none is named. A name no entry carries selects nothing, which is right for a root (a
   * context may keep no read model) and wrong for a command: it compares the name with `contexts`.
   */
  hosting(contexts?: readonly string[]): ReadModelTables {
    return contexts === undefined
      ? this
      : new ReadModelTables(
          this.listed.filter(({ context }) => context !== undefined && contexts.includes(context)),
          this.unlisted,
        );
  }

  /** What each listed table that could be read can hold, in the order of the list. */
  async states(): Promise<readonly ReadModelTableState[]> {
    return (await this.read()).states;
  }

  /** The listed tables that cannot hold the trace of a deleted row, every one of them. */
  async notReady(): Promise<readonly ReadModelTableState[]> {
    return (await this.states()).filter((state) => !readModelTableReady(state));
  }

  /** Refuses with `ReadModelTablesNotReadyError`, which names every listed table that is not ready, with its migration, and every one that could not be read. */
  async require(): Promise<void> {
    const refusal = refusalOf(await this.read(), 'strict');

    if (refusal !== undefined) {
      throw refusal;
    }
  }

  /**
   * The check an application makes when it starts. `required`, the default, refuses to start;
   * `reported` writes the same message as an error and lets the start go on: each store still
   * refuses by name before its first trace. What the check cannot decide is a warning either
   * way: a check constraint that is not validated or that checks something else, another check
   * on a column of the row, a view, a store nobody lists. A database that could not be reached
   * is one warning too, with its cause in a few words, and never a refusal: the check tells the
   * tables that are not ready, it does not make the start wait for the database.
   */
  async atStart(logger: Logger, unready: ReadModelTablesAtStart = 'required'): Promise<void> {
    const reading = await this.read();
    const refusal = refusalOf(reading);

    for (const note of [...unreachedNote(reading), ...this.notes(reading)]) {
      logger.warn(note);
    }

    if (refusal === undefined) {
      return;
    }

    if (unready === 'required') {
      throw refusal;
    }

    logger.error(refusal.message, {
      tables: refusal.tables.map(({ table }) => table).join(', '),
      unread: refusal.unread.map(({ name }) => name).join(', '),
    });
  }

  /** The same check as a command prints it: how many tables it read and their names, the warnings, then every refusal. */
  async report(): Promise<ReadModelTablesReport> {
    const reading = await this.read();
    const refusal = refusalOf(reading, 'strict');
    const { states } = reading;
    const counted = states.length === 1 ? '1 read model table' : `${String(states.length)} read model tables`;

    const lines = [
      states.length === 0 ? this.nothingRead() : `Checked ${counted}: ${states.map(nameOf).join(', ')}.`,
      ...this.notes(reading),
      ...(refusal === undefined ? [] : ['', refusal.message]),
      ...(refusal === undefined && states.length > 0 ? ['Each can hold the trace of a deleted row.'] : []),
    ];

    const unread = reading.unreached !== undefined || (states.length === 0 && reading.unread.length > 0);

    return {
      ready: refusal === undefined,
      outcome: refusal === undefined ? 'ready' : unread ? 'unread' : 'not-ready',
      text: lines.join('\n'),
    };
  }

  private nothingRead(): string {
    return this.listed.length === 0
      ? 'No read model table is listed: nothing was checked.'
      : 'No listed read model keeps a table that could be read.';
  }

  /**
   * Every entry is tried, in the order of the list: one that fails does not hide the next. The
   * reading stops at the first one that finds the database unreachable: the next would wait for
   * the same refusal.
   */
  private async read(): Promise<Reading> {
    const states: ReadModelTableState[] = [];
    const unread: Unread[] = [];

    for (const entry of this.listed) {
      try {
        states.push(...[await entry.build().tableState?.()].filter((state) => state !== undefined));
      } catch (cause) {
        if (cause instanceof ReadModelTableNotReadyError) {
          states.push(cause.state);
        } else if (databaseFailure(cause).unreachable) {
          return { states, unread, unreached: { name: entry.name, cause } };
        } else {
          unread.push({ name: entry.name, cause });
        }
      }
    }

    return { states, unread };
  }

  private notes({ states }: Reading): string[] {
    return [
      ...states.flatMap(readModelTableNotes),
      ...(this.unlisted.length === 0
        ? []
        : [
            `Read model stores of the application are not listed, so nothing checks their tables: ${this.unlisted.join(', ')}. Add each to the list of the read model tables.`,
          ]),
    ];
  }
}

/** The refusal of a reading; `strict`, for a command, a database that could not be reached is one too. */
function refusalOf(reading: Reading, strict?: 'strict'): ReadModelTablesNotReadyError | undefined {
  const refused = reading.states.filter((state) => !readModelTableReady(state));
  const unreached = strict === undefined || reading.unreached === undefined ? [] : [reading.unreached];
  const unread = [...reading.unread, ...unreached];

  return refused.length + unread.length === 0 ? undefined : new ReadModelTablesNotReadyError(refused, unread);
}

function unreachedNote({ unreached }: Reading): string[] {
  return unreached === undefined
    ? []
    : [
        `The read model tables could not be checked: the database could not be reached (${databaseFailure(unreached.cause).cause}). The start goes on; each store still refuses a table that is not ready before its first trace.`,
      ];
}

function nameOf({ schema, table }: ReadModelTableState): string {
  return schema === undefined ? table : `${schema}.${table}`;
}
