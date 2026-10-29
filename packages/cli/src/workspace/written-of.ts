import { cannotWrite } from './cannot-write';
import { writeIfAllowed } from './write-if-allowed';

/** One file of the plan of a command: its path in the project, its new content, whether it was on disk. */
export interface PlannedFile {
  readonly file: string;
  readonly content: string;
  readonly existed: boolean;
}

/** The planned files written, or (dry run) that could be: the others go to `unwritten`. */
export function writtenOf(
  planned: readonly PlannedFile[],
  { dryRun, absolute }: { readonly dryRun: boolean; readonly absolute: (file: string) => string },
  unwritten: string[],
): PlannedFile[] {
  return planned.filter(({ file, content }) => {
    const writable = dryRun ? !cannotWrite(absolute(file)) : writeIfAllowed(absolute(file), content);

    if (!writable) {
      unwritten.push(file);
    }

    return writable;
  });
}
