import fs from 'node:fs';
import { neighbourSuffix } from '../../alias';
import type { Violation } from '../model/violation';
import { ALIAS_FILES } from './alias-files';
import { compilerOptionsOf } from './compiler-options-of';
import type { Inspected } from './inspected';
import { readProjectFile } from './read-project-file';

const { build: BUILD, typeCheck: TYPE_CHECK } = ALIAS_FILES;
const SUPPORT = 'test/support';
/** An import of a neighbour by the `.ts` of its source, as `imports/alias-only` asks of a file directly under test/support/. */
const NEIGHBOUR_SOURCE = /(?:\bfrom|\bimport)\s*\(?\s*['"]\.\/[^/'"]+\.[cm]?ts['"]/;
/** Either option lets the compiler read an import that ends with `.ts`. */
const READS_SOURCES = ['allowImportingTsExtensions', 'rewriteRelativeImportExtensions'];

type Options = Readonly<Record<string, unknown>>;

/**
 * Under "importExtension": "js" the files of `test/support/` name their neighbours by the `.ts` of
 * their source, which a test runner loads before any alias exists. The compiler refuses that ending
 * unless tsconfig.json lets it read sources, which it accepts only of a configuration that emits
 * nothing; the build configuration, which extends it, then has to emit again. Reported here with
 * what both files need: the compiler names the first option alone, then refuses it of a
 * configuration that emits, and a build that inherits `noEmit` writes nothing without a word.
 */
export function neighbourSources(inspected: Inspected): Violation[] {
  const { project } = inspected;
  const checked = compilerOptionsOf(project, TYPE_CHECK);

  if (neighbourSuffix(project.config.importExtension) === '' || checked === undefined) {
    return [];
  }

  const reads = READS_SOURCES.some((option) => checked[option] === true);

  return [
    ...(!reads && namesANeighbourSource(inspected) ? [unread(inspected)] : []),
    ...(silent(compilerOptionsOf(project, BUILD)) ? [unbuilt(inspected)] : []),
  ];
}

function namesANeighbourSource({ project }: Inspected): boolean {
  return supportFiles(project.root).some((file) =>
    NEIGHBOUR_SOURCE.test(readProjectFile(project, `${SUPPORT}/${file}`) ?? ''),
  );
}

function supportFiles(root: string): string[] {
  try {
    return fs.readdirSync(`${root}/${SUPPORT}`).filter((file) => file.endsWith('.ts'));
  } catch {
    return [];
  }
}

/** A build that emits nothing, or that the compiler refuses: it inherited what the type check needs. */
function silent(built: Options | undefined): boolean {
  return built?.['noEmit'] === true || built?.['allowImportingTsExtensions'] === true;
}

function unread({ report }: Inspected): Violation {
  return report(
    { file: TYPE_CHECK, line: 1 },
    `${TYPE_CHECK} does not let the compiler read the ".ts" by which a file of ${SUPPORT}/ names its neighbour.`,
    `Write "allowImportingTsExtensions": true and "noEmit": true under "compilerOptions" in ${TYPE_CHECK}, and both as false in ${BUILD}: a test runner loads its global setup, and what that file imports, from the sources and before any alias exists, so under "importExtension": "js" these files import one another by "./<name>.ts". The compiler accepts that ending only with the first option, and the first option only in a configuration that emits nothing; the build sets both back and emits what it emitted before.`,
  );
}

function unbuilt({ report }: Inspected): Violation {
  return report(
    { file: BUILD, line: 1 },
    `${BUILD} inherits "noEmit" or "allowImportingTsExtensions" from ${TYPE_CHECK}: the build would write nothing, or be refused.`,
    `Write "allowImportingTsExtensions": false and "noEmit": false under "compilerOptions" in ${BUILD}: ${TYPE_CHECK} sets them for the type check alone, which reads the ".ts" a file of ${SUPPORT}/ names its neighbour by, and the build, which compiles no test, emits what ships.`,
  );
}
