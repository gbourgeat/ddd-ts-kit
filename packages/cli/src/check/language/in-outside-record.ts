import type { SourceFile } from '../model/source-file';
import type { StringRecord } from '../scan/string-record';
import { isOutsidePlace } from './is-outside-place';
import { typeDeclarations } from './type-declarations';

/**
 * Whether a literal is a type of an interface or a type alias of `infrastructure/anti-corruption/`
 * or `infrastructure/external/`, which describe an outside record as it arrives (`readonly state:
 * 'draft' | 'issued'`): words of that record, not of the context.
 */
export function inOutsideRecord(file: SourceFile, literal: StringRecord): boolean {
  return (
    isOutsidePlace(file.location) &&
    typeDeclarations(file.scan.code).some(({ start, end }) => start <= literal.start && literal.end <= end)
  );
}
