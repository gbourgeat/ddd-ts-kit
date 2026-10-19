import type { SourceFile } from '../model/source-file.js';
import { codeListName } from './code-list-name.js';
import type { ErrorCode } from './error-code.js';
import { isCodesFile } from './is-codes-file.js';
import { readCodeList } from './read-code-list.js';

/** The codes the code list of a context holds, when `file` is that list: each one is a code set in the context. */
export function listedCodes(file: SourceFile): ErrorCode[] {
  if (!isCodesFile(file) || file.location.area !== 'context') {
    return [];
  }

  const list = readCodeList(file.scan, codeListName(file.location.context));

  return (list?.entries ?? []).flatMap(({ code, line }) => (code === undefined ? [] : [{ code, line }]));
}
