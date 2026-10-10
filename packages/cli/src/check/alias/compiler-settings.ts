import type { Violation } from '../model/violation.js';
import { isRecord } from '../support/is-record.js';
import { ALIAS_FILES } from './alias-files.js';
import { buildLayoutOf } from './build-layout-of.js';
import { compilerOptionsOf } from './compiler-options-of.js';
import type { Inspected } from './inspected.js';

const { build: BUILD, typeCheck: TYPE_CHECK, manifest: MANIFEST } = ALIAS_FILES;
/** Resolutions that do not read the `imports` of package.json. */
const BLIND = ['node', 'node10', 'classic'];

/** The two tsconfig files: the same build layout, a resolution that reads `imports`, and no `paths` entry of their own for an alias. */
export function compilerSettings(inspected: Inspected): Violation[] {
  return [...layouts(inspected), ...[TYPE_CHECK, BUILD].flatMap((file) => ownDeclarations(inspected, file))];
}

function layouts({ project, report }: Inspected): Violation[] {
  const checked = buildLayoutOf(project, TYPE_CHECK);
  const built = buildLayoutOf(project, BUILD);

  if (checked === undefined || built === undefined || JSON.stringify(checked) === JSON.stringify(built)) {
    return [];
  }

  return [
    report(
      { file: BUILD, line: 1 },
      `${TYPE_CHECK} (rootDir "${checked.rootDir}", outDir "${checked.outDir}") and ${BUILD} (rootDir "${built.rootDir}", outDir "${built.outDir}") do not write to the same place.`,
      `Give both the same "rootDir" and "outDir": the type check maps the compiled target of an alias back to its source through them, and the build writes that target.`,
    ),
  ];
}

function ownDeclarations({ project, report, roots }: Inspected, file: string): Violation[] {
  const options = compilerOptionsOf(project, file) ?? {};
  const paths = isRecord(options['paths']) ? Object.keys(options['paths']) : [];
  const resolution = typeof options['moduleResolution'] === 'string' ? options['moduleResolution'].toLowerCase() : '';

  const mapped = paths
    .filter((key) => roots.some(({ prefix }) => key.startsWith(prefix)))
    .map((key) =>
      report(
        { file, line: 1 },
        `${file} maps "${key}" under "paths".`,
        `Remove the entry: Node does not read tsconfig, so the alias is declared once, under "imports" in ${MANIFEST}, which the compiler reads too.`,
      ),
    );

  const blind = BLIND.includes(resolution)
    ? [
        report(
          { file, line: 1 },
          `${file} sets "moduleResolution" to "${resolution}", which does not read the "imports" of ${MANIFEST}.`,
          'Set "module" and "moduleResolution" to "NodeNext": the compiler then resolves an alias as Node does.',
        ),
      ]
    : [];

  return [...mapped, ...blind];
}
