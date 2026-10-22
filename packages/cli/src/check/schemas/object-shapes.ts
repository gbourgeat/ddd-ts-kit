import type { SourceFile } from '../model/source-file';
import { matchingBracket } from '../text/matching-bracket';
import type { DeclaredShape } from './declared-shape';
import { stillGenerated } from './still-generated';
import { topLevelStatements } from './top-level-statements';

/** The object builders of zod, valibot and TypeBox: `z.object({`, `v.object({`, `Type.Object({`. */
const OBJECT_BUILDER = /(?<![\w$])(?:z|v|Type|t)\s*\.\s*(?:object|strictObject|looseObject|Object)\s*\(\s*\{/g;
const DECLARED_AS = /(?:const|let)\s+([A-Za-z_$][\w$]*)[^;]*$/;

/** What a route declares as parameters is documented per operation, never as a component: it is not judged. */
const PARAMETERS = /^(?:params|query|headers)$|(?:Params|Query|Headers)$/;

/**
 * The object schemas a source builds, but those of request parameters and those the generator
 * left to fill: each is its entries, whatever their order and layout.
 */
export function objectShapes(file: SourceFile, code: string): DeclaredShape[] {
  return [...code.matchAll(OBJECT_BUILDER)].flatMap((match) => {
    const open = match.index + match[0].length - 1;
    const close = matchingBracket(code, open);
    const entries = topLevelStatements(code.slice(open + 1, close), ',');
    const declaredAs = DECLARED_AS.exec(code.slice(0, match.index))?.[1];
    const parameters = declaredAs !== undefined && PARAMETERS.test(declaredAs);

    if (entries.length === 0 || parameters || stillGenerated(file, open, close)) {
      return [];
    }

    const key = `object{${entries
      .map((entry) => entry.replace(/\s+/g, ''))
      .sort()
      .join(',')}}`;

    const what = declaredAs === undefined ? 'An object schema' : `The object schema of \`${declaredAs}\``;

    return [{ key, line: file.scan.lineAt(match.index), what }];
  });
}
