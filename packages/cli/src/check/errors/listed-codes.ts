import type { SourceFile } from '../model/source-file';
import { codeListName } from './code-list-name';
import type { ErrorCode } from './error-code';
import { isCodesFile } from './is-codes-file';
import { readCodeList } from './read-code-list';

/** The name the shared kernel gives its code list, `shared-kernel.codes.ts` at its root, as a context would. */
const SHARED_KERNEL = 'shared-kernel';

/** The codes the code list of a context, or of the shared kernel, holds, when `file` is that list: each one is a code set there. */
export function listedCodes(file: SourceFile): ErrorCode[] {
  const owner = listOwner(file);

  if (owner === undefined) {
    return [];
  }

  const list = readCodeList(file.scan, codeListName(owner));

  return (list?.entries ?? []).flatMap(({ code, line }) => (code === undefined ? [] : [{ code, line }]));
}

function listOwner(file: SourceFile): string | undefined {
  if (file.isTest) {
    return undefined;
  }

  if (file.location.area === 'shared-kernel') {
    return file.path.endsWith(`/${SHARED_KERNEL}.codes.ts`) ? SHARED_KERNEL : undefined;
  }

  return isCodesFile(file) && file.location.area === 'context' ? file.location.context : undefined;
}
