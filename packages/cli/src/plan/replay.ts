import { CliError } from '../cli-error';
import type { GeneratorProbe } from '../generate/generator-probe';
import type { HeardName } from '../generate/language-probe';
import { MissingPrerequisite } from '../generate/missing-prerequisite';
import type { Slice } from '../progress/slice';
import type { PlannedCommand } from './planned-commands';

/** Runs `generate` with the arguments that follow it, heard by the probe; throws what the generator refuses. */
export type Generate = (argv: readonly string[], probe: GeneratorProbe) => void;

/** One planned command run in the copy of the project: what the generator heard, built on, created, and refused if it did. */
export interface Replay {
  readonly row: Slice;
  /** As the row writes it. */
  readonly command: string;
  /** The arguments that follow `generate`. */
  readonly argv: readonly string[];
  readonly heard: readonly HeardName[];
  /** The files it builds on, where the generator found them, before any refusal. */
  readonly builtOn: readonly string[];
  /** The files it created. */
  readonly created: readonly string[];
  readonly refusal: Refusal | undefined;
}

/** What the generator refused a command with, said of the project rather than of its copy. */
interface Refusal {
  readonly message: string;
  /** What the generator says to do instead; null when the error is not a refusal of the generator. */
  readonly fix: string | null;
  /** True when what the command builds on is missing: a later row may generate it. */
  readonly missing: boolean;
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
  const builtOn: string[] = [];
  const created: string[] = [];
  const done = { row, command: text, argv, heard, builtOn, created };

  try {
    generate(argv, {
      language: (name) => heard.push(name),
      builtOn: (file) => builtOn.push(file),
      created: (files) => created.push(...files),
    });

    return { ...done, refusal: undefined };
  } catch (error) {
    return { ...done, refusal: refusalOf(error, copy) };
  }
}

function refusalOf(error: unknown, copy: string): Refusal {
  // The generator repeats the command it refuses, `--cwd <copy>` added by the replay included.
  const ofProject = (text: string): string =>
    text.split(` --cwd ${copy}`).join('').split(`${copy}/`).join('').split(copy).join('.');

  const message = ofProject(error instanceof Error ? error.message : String(error));

  if (!(error instanceof CliError)) {
    return { message, fix: null, missing: false };
  }

  return { message, fix: ofProject(error.fix), missing: error instanceof MissingPrerequisite };
}
