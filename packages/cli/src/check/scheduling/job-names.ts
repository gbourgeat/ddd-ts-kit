import { wholeLiteral } from '../declarations/whole-literal';
import type { SourceFile } from '../model/source-file';
import { jobsDeclared } from './jobs-declared';
import type { ListPart } from '../text/list-part';

/** The name a job is declared or registered under: the first argument of `@Scheduled(..)` or of `.job(..)`. */
export interface JobName {
  /** `@Scheduled` or `job(...)`. */
  readonly owner: string;
  readonly line: number;
  /** The name, when it is written as one string literal. */
  readonly literal: string | undefined;
}

/** The job names a source writes. */
export function jobNames(file: SourceFile): JobName[] {
  return jobsDeclared(file).map(({ owner, line, args }) => ({ owner, line, literal: literalOf(file, args[0]) }));
}

function literalOf(file: SourceFile, name: ListPart | undefined): string | undefined {
  return name === undefined ? undefined : wholeLiteral(file.scan, name);
}
