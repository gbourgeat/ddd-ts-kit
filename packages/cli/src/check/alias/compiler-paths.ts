import { compilerPaths as expectedPaths } from '../../alias/index.js';
import type { Violation } from '../model/violation.js';
import { isRecord } from '../support/is-record.js';
import { ALIAS_FILES } from './alias-files.js';
import { compilerOptionsOf } from './compiler-options-of.js';
import type { Inspected } from './inspected.js';

const { build: BUILD, typeCheck: TYPE_CHECK } = ALIAS_FILES;

/**
 * The `paths` of the two tsconfig files against what `importAlias` gives: every expected entry is
 * there, written the same, no other entry starts with an alias, and no `baseUrl` moves them.
 */
export function compilerPaths(inspected: Inspected): Violation[] {
  const checked = compilerOptionsOf(inspected.project, TYPE_CHECK);
  const built = compilerOptionsOf(inspected.project, BUILD);

  // A build config that inherits everything says nothing of its own: the findings of the type check cover it.
  const own = built !== undefined && declared(built) !== declared(checked ?? {}) ? [[BUILD, built] as const] : [];
  const read = [...(checked === undefined ? [] : [[TYPE_CHECK, checked] as const]), ...own];

  return read.flatMap(([file, options]) => [...unlike(inspected, file, options), ...moved(inspected, file, options)]);
}

function declared(options: Options): string {
  return JSON.stringify([options['paths'], options['baseUrl']]);
}

type Options = Readonly<Record<string, unknown>>;

function unlike({ report, roots }: Inspected, file: string, options: Options): Violation[] {
  const expected = expectedPaths(roots);
  const written = isRecord(options['paths']) ? options['paths'] : {};

  const missing = Object.entries(expected)
    .filter(([key, targets]) => JSON.stringify(written[key]) !== JSON.stringify(targets))
    .map(([key, targets]) =>
      report(
        { file, line: 1 },
        written[key] === undefined
          ? `${file} declares no "paths" entry for "${key}".`
          : `The "paths" entry "${key}" of ${file} is not what "importAlias" gives.`,
        `Write "${key}": ${JSON.stringify(targets)} under "compilerOptions.paths" in ${TYPE_CHECK}, which ${BUILD} extends: it is the declaration the compiler, tsx, vitest, knip and dependency-cruiser resolve the alias from.`,
      ),
    );

  const shadowing = Object.keys(written)
    .filter((key) => !(key in expected) && roots.some(({ prefix }) => key.startsWith(prefix)))
    .map((key) =>
      report(
        { file, line: 1 },
        `The "paths" entry "${key}" of ${file} starts with an alias of the project and is not the one the kit derives.`,
        'Remove it: the build rewrites an alias from "importAlias" alone, so a second entry under the same prefix makes the compiled output load another file than the one the compiler checked.',
      ),
    );

  return [...missing, ...shadowing];
}

function moved({ report }: Inspected, file: string, options: Options): Violation[] {
  if (options['baseUrl'] === undefined) {
    return [];
  }

  return [
    report(
      { file, line: 1 },
      `${file} sets "baseUrl", which every "paths" target is then resolved from.`,
      'Remove "baseUrl": the targets of "paths" are written from the directory of the tsconfig, which is where the other tools and the build read them from.',
    ),
  ];
}
