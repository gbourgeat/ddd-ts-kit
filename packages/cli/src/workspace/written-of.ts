import { cannotWrite } from './cannot-write';
import type { DiskWrites } from './disk-writes';
import type { RealPath } from './real-path-of';
import { writeIfAllowed } from './write-if-allowed';

/** One file of the plan of a command: its path in the project, its new content, whether it was on disk. */
export interface PlannedFile {
  readonly file: string;
  readonly content: string;
  readonly existed: boolean;
}

/** How the plan is written: for real or not (dry run), where each file lands, its real path resolved once, and the disk that holds them. */
export interface PlanWriting {
  readonly dryRun: boolean;
  readonly absolute: (file: string) => string;
  readonly real: ReadonlyMap<string, RealPath>;
  readonly disk: DiskWrites;
}

/** The planned files written, or (dry run) that could be: the others go to `unwritten`. */
export function writtenOf(
  planned: readonly PlannedFile[],
  { dryRun, absolute, real, disk }: PlanWriting,
  unwritten: string[],
): PlannedFile[] {
  return planned.filter(({ file, content }) => {
    const writable = dryRun
      ? !cannotWrite(absolute(file))
      : writeIfAllowed(absolute(file), content, { disk, real: real.get(file) });

    if (!writable) {
      unwritten.push(file);
    }

    return writable;
  });
}
