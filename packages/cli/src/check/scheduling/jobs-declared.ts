import { argumentsOf } from '../declarations/arguments-of';
import { classesOf } from '../declarations/classes-of';
import type { SourceFile } from '../model/source-file';
import { importsPackage } from '../support/imports-package';
import { callArguments } from '../text/call-arguments';
import type { ListPart } from '../text/list-part';

const JOB_CALL = /\.\s*job\s*\(/g;

/** A job as a source declares it: `@Scheduled(..)` or `.job(..)`, with the arguments it is given. */
export interface JobDeclared {
  readonly owner: string;
  readonly line: number;
  readonly args: readonly ListPart[];
}

/** The jobs a source declares; `.job(..)` is read in a module file and in a file that imports `@ddd-ts-kit/di`. */
export function jobsDeclared(file: SourceFile): JobDeclared[] {
  const { scan } = file;

  const declared = classesOf(scan).flatMap(({ decorations }) =>
    decorations
      .filter(({ name }) => name === 'Scheduled')
      .map((decoration) => ({ owner: '@Scheduled', line: decoration.line, args: argumentsOf(scan, decoration) })),
  );

  const registered = registersJobs(file)
    ? [...scan.code.matchAll(JOB_CALL)].map((match) => ({
        owner: 'job(...)',
        line: scan.lineAt(match.index),
        args: callArguments(scan.code, match.index + match[0].length - 1),
      }))
    : [];

  return [...declared, ...registered];
}

function registersJobs(file: SourceFile): boolean {
  return (
    (file.location.area === 'context' && file.location.layer === 'module') || importsPackage(file, '@ddd-ts-kit/di')
  );
}
