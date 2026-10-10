import { DEFAULT_BUILD_LAYOUT, importMap } from '../../alias/index.js';
import type { Violation } from '../model/violation.js';
import { isRecord } from '../support/is-record.js';
import { lineOf } from '../support/line-of.js';
import { ALIAS_FILES } from './alias-files.js';
import { buildLayoutOf } from './build-layout-of.js';
import type { Inspected } from './inspected.js';
import { parseJsonc } from './parse-jsonc.js';
import { readProjectFile } from './read-project-file.js';

const { manifest: MANIFEST, build: BUILD, typeCheck: TYPE_CHECK } = ALIAS_FILES;

/**
 * The `imports` of package.json against what `importAlias` and the tsconfig of the build give:
 * every expected entry is there, written the same, and no other entry starts with an alias.
 */
export function manifestImports(inspected: Inspected): Violation[] {
  const { project, roots } = inspected;
  const text = readProjectFile(project, MANIFEST);
  const manifest = text === undefined ? undefined : parseJsonc(text);

  if (text === undefined || manifest === undefined) {
    return [];
  }

  const layout = buildLayoutOf(project, BUILD) ?? buildLayoutOf(project, TYPE_CHECK) ?? DEFAULT_BUILD_LAYOUT;
  const expected = importMap(roots, layout);
  const written = isRecord(manifest['imports']) ? manifest['imports'] : {};

  return [...unlike(inspected, text, { expected, written }), ...shadowing(inspected, text, { expected, written })];
}

interface Compared {
  readonly expected: Readonly<Record<string, unknown>>;
  readonly written: Readonly<Record<string, unknown>>;
}

function unlike({ report }: Inspected, text: string, { expected, written }: Compared): Violation[] {
  return Object.entries(expected)
    .filter(([key, targets]) => JSON.stringify(written[key]) !== JSON.stringify(targets))
    .map(([key, targets]) => {
      const message =
        written[key] === undefined
          ? `${MANIFEST} declares no "imports" entry for "${key}".`
          : `The "imports" entry "${key}" of ${MANIFEST} is not what "importAlias" and the tsconfig of the build give.`;

      return report(
        { file: MANIFEST, line: lineOf(text, written[key] === undefined ? '"imports"' : `"${key}"`) },
        message,
        `Write "${key}": ${JSON.stringify(targets)} under "imports" in ${MANIFEST}, conditions in this order: it is the one declaration Node, the compiler, the runners, knip and dependency-cruiser resolve the alias from.`,
      );
    });
}

function shadowing({ report, roots }: Inspected, text: string, { expected, written }: Compared): Violation[] {
  return Object.keys(written)
    .filter((key) => !(key in expected) && roots.some(({ prefix }) => key.startsWith(prefix)))
    .map((key) =>
      report(
        { file: MANIFEST, line: lineOf(text, `"${key}"`) },
        `The "imports" entry "${key}" of ${MANIFEST} starts with an alias of the project and is not the one the kit derives.`,
        `Remove it: a second entry under the same prefix makes Node and the compiler pick a target by the length of the pattern, and the tools stop agreeing.`,
      ),
    );
}
