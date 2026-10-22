import type { SourceFile } from '../model/source-file';
import type { ErrorCode } from './error-code';
import { errorCodes } from './error-codes';
import { listedCodes } from './listed-codes';
import { refusalClasses } from './refusal-classes';

/**
 * Every code a source sets: those its refusals give themselves, and, for the code list of a
 * context, those it holds. A refusal class sets its code through that list only: a code it writes
 * another way is the business of `errors/code-listed`, and would else count twice.
 */
export function codesSetIn(file: SourceFile): ErrorCode[] {
  const { scan } = file;
  const named = refusalClasses(scan).map((shape) => ({ from: shape.line, to: scan.lineAt(shape.end) }));
  const own = errorCodes(scan).filter(({ line }) => !named.some(({ from, to }) => line >= from && line <= to));

  return [...own, ...listedCodes(file)].sort((a, b) => a.line - b.line);
}
