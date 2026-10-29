import fs from 'node:fs';
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
export interface Refusal {
  readonly message: string;
  /** What the generator says to do instead; null when the error is not a refusal of the generator. */
  readonly fix: string | null;
  /** True when what the command builds on is missing: a later row may generate it. */
  readonly missing: boolean;
}

/** The copy of the project the commands are replayed in, and the generator that writes there. */
export interface InCopy {
  /** The directory of the copy, which a refusal does not name, as given or as the system resolves it. */
  readonly copy: string;
  readonly generate: Generate;
  /** Runs the command with `--dry-run`: it hears what it builds on and leaves the copy as it was. */
  readonly dryRun?: boolean;
}

/** Runs one planned command of a row in the copy. */
export function replayed(row: Slice, { text, argv }: PlannedCommand, inCopy: InCopy): Replay {
  const heard: HeardName[] = [];
  const builtOn: string[] = [];
  const created: string[] = [];
  const done = { row, command: text, argv, heard, builtOn, created };

  try {
    inCopy.generate(inCopy.dryRun === true ? [...argv, DRY_RUN] : argv, {
      language: (name) => heard.push(name),
      builtOn: (file) => builtOn.push(file),
      created: (files) => created.push(...files),
    });

    return { ...done, refusal: undefined };
  } catch (error) {
    return { ...done, refusal: refusalOf(error, inCopy) };
  }
}

const DRY_RUN = '--dry-run';

function refusalOf(error: unknown, inCopy: InCopy): Refusal {
  const ofProject = withoutCopy(inCopy);
  const message = ofProject(error instanceof Error ? error.message : String(error));

  if (!(error instanceof CliError)) {
    return { message, fix: null, missing: false };
  }

  return { message, fix: ofProject(error.fix), missing: error instanceof MissingPrerequisite };
}

/**
 * A text of the generator said of the project: the `--cwd <copy>` and the `--dry-run` the replay
 * added to the command it repeats left out, and each path in the copy made relative, the copy
 * named as given or by its real path (`/private/var/...` for `/var/...` on macOS). A bare mention
 * of the copy is left as it is: it names no file of the project.
 */
function withoutCopy({ copy, dryRun }: InCopy): (text: string) => string {
  const paths = [...new Set([copy, realPathOf(copy)])].sort((left, right) => right.length - left.length);

  return (text) => {
    const relative = paths.reduce(
      (said, path) => said.split(` --cwd ${path}`).join('').split(`${path}/`).join(''),
      text,
    );

    return dryRun === true ? relative.split(` ${DRY_RUN}`).join('') : relative;
  };
}

function realPathOf(directory: string): string {
  try {
    return fs.realpathSync(directory);
  } catch {
    return directory;
  }
}
