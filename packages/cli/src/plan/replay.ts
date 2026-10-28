import { CliError } from '../cli-error';
import type { HeardName, LanguageProbe } from '../generate/language-probe';
import { MissingPrerequisite } from '../generate/missing-prerequisite';
import type { Slice } from '../progress/slice';
import type { PlannedCommand } from './planned-commands';

/** Runs `generate` with the arguments that follow it, hearing its names with the probe; throws what the generator refuses. */
export type Generate = (argv: readonly string[], language: LanguageProbe) => void;

/** One planned command run in the copy of the project: the names the generator introduced, and what it refused if it did. */
export interface Replay {
  readonly row: Slice;
  /** As the row writes it. */
  readonly command: string;
  /** The arguments that follow `generate`. */
  readonly argv: readonly string[];
  readonly heard: readonly HeardName[];
  readonly refusal: Refusal | undefined;
}

/** What the generator refused a command with, said of the project rather than of its copy. */
interface Refusal {
  readonly message: string;
  /** What the generator says to do instead; null when the error is not a refusal of the generator. */
  readonly fix: string | null;
  /** The command that creates what the command builds on, when that is what is missing; null otherwise. */
  readonly missing: string | null;
}

/** The copy of the project the commands are replayed in, and the generator that writes there. */
export interface InCopy {
  /** The directory of the copy, which a refusal does not name. */
  readonly copy: string;
  readonly generate: Generate;
}

/** Runs one planned command of a row in the copy. */
export function replayed(row: Slice, { text, argv }: PlannedCommand, { copy, generate }: InCopy): Replay {
  const heard: HeardName[] = [];

  try {
    generate(argv, (name) => heard.push(name));

    return { row, command: text, argv, heard, refusal: undefined };
  } catch (error) {
    return { row, command: text, argv, heard, refusal: refusalOf(error, copy) };
  }
}

function refusalOf(error: unknown, copy: string): Refusal {
  // The generator repeats the command it refuses, `--cwd <copy>` added by the replay included.
  const ofProject = (text: string): string =>
    text.split(` --cwd ${copy}`).join('').split(`${copy}/`).join('').split(copy).join('.');

  const message = ofProject(error instanceof Error ? error.message : String(error));

  if (!(error instanceof CliError)) {
    return { message, fix: null, missing: null };
  }

  return {
    message,
    fix: ofProject(error.fix),
    missing: error instanceof MissingPrerequisite ? error.createdBy : null,
  };
}
