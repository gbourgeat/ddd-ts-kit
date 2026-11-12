import fs from 'node:fs';
import { neighbourSuffix } from '../../alias';
import type { Violation } from '../model/violation';
import { loadSourceFile } from '../project/load-source-file';
import { ALIAS_FILES } from './alias-files';
import { compilerOptionsOf } from './compiler-options-of';
import type { Inspected } from './inspected';
import { manifestScripts } from './manifest-scripts';
import { readProjectFile } from './read-project-file';
import { scriptSteps } from './script-steps';

const { build: BUILD, typeCheck: TYPE_CHECK } = ALIAS_FILES;
const SUPPORT = 'test/support';
/** A neighbour named by the `.ts` of its source, as `imports/alias-only` asks of a file directly under test/support/; a declaration file is no source. */
const NEIGHBOUR_SOURCE = /^\.\/[^/]+\.[cm]?ts$/;
const DECLARATION = /\.d\.[cm]?ts$/;
/** Either option lets the compiler read an import that ends with `.ts`. */
const READS_SOURCES = ['allowImportingTsExtensions', 'rewriteRelativeImportExtensions'];
/** What the compiler accepts `allowImportingTsExtensions` with, in a configuration that emits. */
const READS_AND_EMITS = ['rewriteRelativeImportExtensions', 'emitDeclarationOnly'];

type Options = Readonly<Record<string, unknown>>;

/**
 * Under "importExtension": "js" the files of `test/support/` name their neighbours by the `.ts` of
 * their source, which a test runner loads before any alias exists. The compiler refuses that ending
 * unless tsconfig.json lets it read sources, which it accepts only of a configuration that emits
 * nothing; a configuration that extends it and builds then has to emit again. Whatever the ending,
 * a configuration a script compiles what ships with, and tsconfig.build.json, emit: one that
 * resolves `noEmit` writes nothing without an error.
 */
export function neighbourSources(inspected: Inspected): Violation[] {
  const { project } = inspected;
  const checked = compilerOptionsOf(project, TYPE_CHECK);

  if (checked === undefined) {
    return [];
  }

  const asked = neighbourSuffix(project.config.importExtension) !== '' && namesANeighbourSource(inspected);
  const reads = READS_SOURCES.some((option) => checked[option] === true);

  return [
    ...(asked && !reads ? [unread(inspected)] : []),
    ...builds(inspected)
      .filter((file) => silent(compilerOptionsOf(project, file)))
      .map((file) => unbuilt(inspected, file)),
  ];
}

/** The imports of each file are read as the other rules read them: a comment or a string names nothing. */
function namesANeighbourSource({ project }: Inspected): boolean {
  return supportFiles(project.root).some((file) => {
    const path = `${SUPPORT}/${file}`;
    const { imports } = loadSourceFile(project.config, path, readProjectFile(project, path) ?? '');

    return imports.some(({ specifier }) => NEIGHBOUR_SOURCE.test(specifier) && !DECLARATION.test(specifier));
  });
}

function supportFiles(root: string): string[] {
  try {
    return fs.readdirSync(`${root}/${SUPPORT}`).filter((file) => file.endsWith('.ts'));
  } catch {
    return [];
  }
}

/** tsconfig.build.json, and each configuration a script of package.json compiles what ships with. */
function builds(inspected: Inspected): string[] {
  const steps = (manifestScripts(inspected)?.scripts ?? []).flatMap(([, command]) => scriptSteps(command));

  return [...new Set([BUILD, ...steps.filter((step) => step.compiles).map((step) => step.project)])];
}

/**
 * A build that emits nothing, or that the compiler refuses. `noEmit` wins over every other option;
 * `allowImportingTsExtensions` is accepted of a build that rewrites those endings or emits
 * declarations alone.
 */
function silent(built: Options = {}): boolean {
  const refused =
    built['allowImportingTsExtensions'] === true && !READS_AND_EMITS.some((option) => built[option] === true);

  return built['noEmit'] === true || refused;
}

function unread({ report }: Inspected): Violation {
  return report(
    { file: TYPE_CHECK, line: 1 },
    `${TYPE_CHECK} does not let the compiler read the ".ts" by which a file of ${SUPPORT}/ names its neighbour.`,
    `Write "allowImportingTsExtensions": true and "noEmit": true under "compilerOptions" in ${TYPE_CHECK}, and both as false in ${BUILD}: a test runner loads its global setup, and what that file imports, from the sources and before any alias exists, so under "importExtension": "js" these files import one another by "./<name>.ts". The compiler accepts that ending only with the first option, and the first option only in a configuration that emits nothing; the build sets both back and emits what it emitted before.`,
  );
}

function unbuilt({ report }: Inspected, file: string): Violation {
  const remedy =
    file === TYPE_CHECK
      ? `Compile ${BUILD} in that script (\`tsc -p ${BUILD}\`), which extends ${TYPE_CHECK} and sets "noEmit" and "allowImportingTsExtensions" back to false`
      : `Write "allowImportingTsExtensions": false and "noEmit": false under "compilerOptions" in ${file}`;

  return report(
    { file, line: 1 },
    `${file} builds what ships and resolves "noEmit": true, or "allowImportingTsExtensions": true without what the compiler accepts it with: the build would write nothing, or be refused.`,
    `${remedy}: a configuration that type-checks emits nothing, the one it is extended by to build inherits that, and the compiler then writes no file without an error, so that an earlier output would ship. \`ddd-ts-kit build-aliases\` refuses such a build too.`,
  );
}
