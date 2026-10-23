import type { Exported } from '../exports/exported';
import type { SourceFile } from '../model/source-file';
import { importedFrom } from '../support/imported-from';
import type { FunctionBody } from './function-body';

/** `): EventStamp {` or `): EventStamp =>`: the return type a function declares, by the name it starts with. */
const RETURN_TYPE = /\)\s*:\s*([A-Za-z_$][\w$]*)[^()]*$/;

/**
 * Whether a function declares that it returns a type of a package (`): EventStamp` of the kernel):
 * the shape is the one of the library, which the project cannot make a class of its own.
 */
export function returnsPackageType(file: SourceFile, { text }: Exported, body: FunctionBody): boolean {
  const name = RETURN_TYPE.exec(text.slice(0, body.kind === 'block' ? body.open : body.start))?.[1];

  return name !== undefined && importedFrom(file, name)?.target.kind === 'package';
}
