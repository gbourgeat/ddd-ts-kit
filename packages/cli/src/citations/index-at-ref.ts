import { runGit } from '../commit/run-git.js';
import { linesOf } from './lines-of.js';
import type { Declaration } from './declaration.js';
import type { NameIndex } from './name-index.js';
import { nameIndexOf } from './name-index-of.js';

/** A declaration of a PascalCase name, in the extended expressions git grep reads on every platform. */
const DECLARATION = '(class|interface|type|enum|function|const)[[:space:]]+[A-Z][A-Za-z0-9_$]*';
/** A match as git grep prints it after the ref: the file, then the declared name. */
const MATCH = /^(.+):(?:class|interface|type|enum|function|const)\s+(\S+)$/;

/**
 * What the code has at a ref, read from git without checking it out: the files under the source
 * root (`git ls-tree`) and the names they declare (`git grep`), paths relative to the project.
 */
export function indexAtRef(root: string, ref: string, sourceRoot: string): NameIndex {
  const files = linesOf(runGit(root, ['ls-tree', '-r', '--name-only', ref, '--', sourceRoot]));
  const found = linesOf(runGit(root, ['grep', '-o', '-E', DECLARATION, ref, '--', sourceRoot]));

  return nameIndexOf(
    found.flatMap((line) => declarationOf(line, ref)),
    files,
  );
}

/** `<ref>:<file>:class Name`, as git grep prints a match in a tree. */
function declarationOf(line: string, ref: string): Declaration[] {
  const [, file, name] = MATCH.exec(line.slice(ref.length + 1)) ?? [];

  return file === undefined || name === undefined ? [] : [{ file, name }];
}
