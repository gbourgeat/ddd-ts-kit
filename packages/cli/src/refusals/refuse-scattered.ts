import path from 'node:path';
import { CliError } from '../cli-error.js';

/** One error class that a plan gathers into a class of refusals, and the file it is read from. */
export interface GatheredError {
  readonly context: string;
  /** The class of refusals the error joins. */
  readonly className: string;
  readonly file: string;
}

/**
 * A class of refusals is written once, next to the errors it replaces: errors of one class read
 * from two folders (a module of the model and the level of the context, or two modules) would
 * give two classes of one name, or imports of a file never written. Nothing is written then.
 */
export function refuseScattered(gathered: readonly GatheredError[]): void {
  const folders = new Map<string, Set<string>>();

  for (const { context, className, file } of gathered) {
    const key = `${context}/${className}`;
    const known = folders.get(key) ?? new Set<string>();

    known.add(path.posix.dirname(file));
    folders.set(key, known);
  }

  const scattered = [...folders].filter(([, known]) => known.size > 1);

  if (scattered.length === 0) {
    return;
  }

  const said = scattered.map(([key, known]) => `${key} would gather errors of ${[...known].join(' and ')}`).join('; ');

  throw new CliError(
    `Nothing was written: ${said}.`,
    'A class of refusals lives in one place: move the errors of one concept into the module that owns it (`ddd-ts-kit move-to-module`), then run the command again.',
  );
}
