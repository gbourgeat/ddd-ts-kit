import { argumentsOf } from '../declarations/arguments-of.js';
import { classesOf } from '../declarations/classes-of.js';
import { wholeLiteral } from '../declarations/whole-literal.js';
import type { SourceFile } from '../model/source-file.js';
import { importsPackage } from '../support/imports-package.js';
import { callArguments } from '../text/call-arguments.js';
import type { ListPart } from '../text/list-part.js';

const JOB_CALL = /\.\s*job\s*\(/g;

/** The name a job is declared or registered under: the first argument of `@Scheduled(..)` or of `.job(..)`. */
export interface JobName {
  /** `@Scheduled` or `job(...)`. */
  readonly owner: string;
  readonly line: number;
  /** The name, when it is written as one string literal. */
  readonly literal: string | undefined;
}

/** The job names a source writes; `.job(..)` is read in a module file and in a file that imports `@ddd-ts-kit/di`. */
export function jobNames(file: SourceFile): JobName[] {
  const { scan } = file;
  const declared = classesOf(scan).flatMap(({ decorations }) => decorations.filter(({ name }) => name === 'Scheduled').map((decoration) => ({ owner: '@Scheduled', line: decoration.line, name: argumentsOf(scan, decoration)[0] })));
  const registered = registersJobs(file) ? [...scan.code.matchAll(JOB_CALL)].map((match) => ({ owner: 'job(...)', line: scan.lineAt(match.index), name: callArguments(scan.code, match.index + match[0].length - 1)[0] })) : [];

  return [...declared, ...registered].map(({ owner, line, name }) => ({ owner, line, literal: literalOf(file, name) }));
}

function registersJobs(file: SourceFile): boolean {
  return (file.location.area === 'context' && file.location.layer === 'module') || importsPackage(file, '@ddd-ts-kit/di');
}

function literalOf(file: SourceFile, name: ListPart | undefined): string | undefined {
  return name === undefined ? undefined : wholeLiteral(file.scan, name);
}
