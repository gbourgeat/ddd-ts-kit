import type { SourceFile } from '../model/source-file.js';
import { callArguments } from '../text/call-arguments.js';
import type { ListPart } from '../text/list-part.js';
import { splitTopLevel } from '../text/split-top-level.js';
import { argumentsOf } from './arguments-of.js';
import { classesOf } from './classes-of.js';
import type { DependencyList } from './dependency-list.js';

const WIRING_CALL = /\.\s*(toClass|handledBy)\s*\(/g;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * The dependency lists a source writes: the last argument of a declaration decorator, and the
 * second argument of `.toClass(C, [..])` and `.handledBy(H, [..])`.
 */
export function dependencyLists(file: SourceFile): DependencyList[] {
  const { scan } = file;

  const declared = classesOf(scan).flatMap(({ decorations }) =>
    decorations.map((decoration) => ({ owner: `@${decoration.name}`, list: argumentsOf(scan, decoration).at(-1) })),
  );

  const wired = [...scan.code.matchAll(WIRING_CALL)].map((match) => ({
    owner: match[1] ?? '',
    list: callArguments(scan.code, match.index + match[0].length - 1)[1],
  }));

  return [...declared, ...wired].flatMap(({ owner, list }) =>
    list?.code.startsWith('[') === true ? [listOf(file, owner, list)] : [],
  );
}

function listOf(file: SourceFile, owner: string, list: ListPart): DependencyList {
  const inside = list.code.slice(1, list.code.lastIndexOf(']'));

  const names = splitTopLevel(inside)
    .filter((part) => IDENTIFIER.test(part.code))
    .map((part) => ({ name: part.code, line: file.scan.lineAt(list.start + 1 + part.start) }));

  return { owner, line: file.scan.lineAt(list.start), names };
}
