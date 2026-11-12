import type { Logger } from '../../application/ports/logger';
import { liveRowsConstraintOf } from './live-rows-constraint-of';
import { readModelTableMigration } from './read-model-table-migration';
import { ReadModelTableNotReadyError } from './read-model-table-not-ready-error';
import { readModelTableReady } from './read-model-table-ready';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';
import { ReadModelTablesNotReadyError } from './read-model-tables-not-ready-error';

/** A read model as an application lists it: its store, or the table under it, which reads what that table can hold. */
export interface ReadModelInATable {
  /** Absent, or `undefined`, where the rows are not kept in a table: such a read model has nothing to check. */
  tableState?(): Promise<ReadModelTableState | undefined>;
}

/**
 * What an application does at its start with the listed tables that are not ready: `required`
 * refuses to start, `reported` logs them as one error and starts, for a deployment that starts
 * the application before its migrations ran.
 */
export type ReadModelTablesAtStart = 'required' | 'reported';

/** What a check of the listed tables found, as a command says it. */
export interface ReadModelTablesReport {
  readonly ready: boolean;
  readonly text: string;
}

/**
 * The read model tables an application declares, checked in one pass before a request or an
 * event reaches a store, whenever the stores themselves are built. Each entry builds the store of
 * one read model, the class the application binds, with its own options: the table is then read
 * by the code that store runs before its first trace, so the verdict is the store's and the
 * migration names its columns. A store whose definition already refuses its table is reported
 * like the others. Nothing is guessed from the database: a table that is not listed is not read,
 * and an empty list checks nothing and says nothing.
 */
export class ReadModelTables {
  constructor(private readonly listed: readonly (() => ReadModelInATable)[]) {}

  /** What each listed table can hold, in the order of the list. */
  async states(): Promise<readonly ReadModelTableState[]> {
    const states: (ReadModelTableState | undefined)[] = [];

    for (const build of this.listed) {
      states.push(await stateOf(build));
    }

    return states.filter((state) => state !== undefined);
  }

  /** The listed tables that cannot hold the trace of a deleted row, every one of them. */
  async notReady(): Promise<readonly ReadModelTableState[]> {
    return (await this.states()).filter((state) => !readModelTableReady(state));
  }

  /** Refuses with `ReadModelTablesNotReadyError`, which names every listed table that is not ready and its migration. */
  async require(): Promise<void> {
    const unready = await this.notReady();

    if (unready.length > 0) {
      throw new ReadModelTablesNotReadyError(unready);
    }
  }

  /**
   * The check an application makes when it starts. `required`, the default, refuses to start;
   * `reported` writes the same message as an error and lets the start go on: each store still
   * refuses by name before its first trace. A check constraint that is not validated, or that
   * checks something else, is a warning either way: such a table holds a trace.
   */
  async atStart(logger: Logger, unready: ReadModelTablesAtStart = 'required'): Promise<void> {
    const states = await this.states();
    const refused = states.filter((state) => !readModelTableReady(state));

    for (const note of states.flatMap(noteOf)) {
      logger.warn(note);
    }

    if (refused.length === 0) {
      return;
    }

    const refusal = new ReadModelTablesNotReadyError(refused);

    if (unready === 'required') {
      throw refusal;
    }

    logger.error(refusal.message, { tables: refusal.tables.map(({ table }) => table).join(', ') });
  }

  /** The same check as a command prints it: how many tables it read and their names, the warnings, then every refusal. */
  async report(): Promise<ReadModelTablesReport> {
    const states = await this.states();
    const refused = states.filter((state) => !readModelTableReady(state));
    const counted = states.length === 1 ? '1 read model table' : `${String(states.length)} read model tables`;

    const lines = [
      states.length === 0
        ? 'No read model table is listed: nothing was checked.'
        : `Checked ${counted}: ${states.map(nameOf).join(', ')}.`,
      ...states.flatMap(noteOf),
      ...(refused.length === 0 ? [] : ['', new ReadModelTablesNotReadyError(refused).message]),
      ...(refused.length === 0 && states.length > 0 ? ['Each can hold the trace of a deleted row.'] : []),
    ];

    return { ready: refused.length === 0, text: lines.join('\n') };
  }
}

/** A store built on a definition that refuses its table says so when it is built: that refusal is the state of its table. */
async function stateOf(build: () => ReadModelInATable): Promise<ReadModelTableState | undefined> {
  try {
    return await build().tableState?.();
  } catch (error) {
    if (error instanceof ReadModelTableNotReadyError) {
      return error.state;
    }

    throw error;
  }
}

function nameOf({ schema, table }: ReadModelTableState): string {
  return schema === undefined ? table : `${schema}.${table}`;
}

/** What is said of a check constraint that does not keep the live rows whole as the kit writes it: the table holds a trace all the same. */
function noteOf(state: ReadModelTableState): string[] {
  const name = liveRowsConstraintOf(state.table);

  if (state.constraint?.state === 'not-valid') {
    return [
      `The check constraint ${name} of ${nameOf(state)} is not validated: the rows written before it are not held to it. Run: ${readModelTableMigration(state).join(' ')}`,
    ];
  }

  return state.constraint?.state === 'unexpected'
    ? [
        `The check constraint ${name} of ${nameOf(state)} does not read as "deleted or (<column> is not null and ...)": ${String(state.constraint.definition)}. It is left as it is.`,
      ]
    : [];
}
