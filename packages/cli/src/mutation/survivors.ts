import type { Config } from '../config';
import type { MutationReport } from './read-mutation-report';

/** A mutant no test noticed: a rule no test states, or an accident of the code to leave alive and say so. */
export interface Survivor {
  readonly context: string;
  readonly file: string;
  readonly line: number;
  readonly mutator: string;
  readonly replacement: string;
  /** `Survived` when the tests that cover the line let it through, `NoCoverage` when no test runs the line. */
  readonly status: string;
}

const UNDETECTED = new Set(['Survived', 'NoCoverage']);

/**
 * The survivors of the report, by context, file and line, in the files of a context; the ones of
 * the given files alone when `files` names some (the files a change touched), none of a file
 * outside the contexts directory.
 */
export function survivors(report: MutationReport, config: Config, files?: ReadonlySet<string>): Survivor[] {
  const prefix = `${config.contextsDir}/`;

  return Object.entries(report)
    .filter(([file]) => file.startsWith(prefix) && (files === undefined || files.has(file)))
    .flatMap(([file, mutants]) =>
      mutants
        .filter(({ status }) => UNDETECTED.has(status))
        .map(({ status, mutator, line, replacement }) => ({
          context: file.slice(prefix.length).split('/')[0] ?? '',
          file,
          line,
          mutator,
          replacement,
          status,
        })),
    )
    .filter(({ context }) => context !== '')
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}
