import { compilerResolutionOf, specifierSuffix } from '../../alias';
import type { Violation } from '../model/violation';
import { ALIAS_FILES } from './alias-files';
import { compilerOptionsOf } from './compiler-options-of';
import type { Inspected } from './inspected';

const { build: BUILD, typeCheck: TYPE_CHECK } = ALIAS_FILES;
/** The resolutions of the compiler that read a specifier as Node does: the extension is required. */
const AS_NODE = ['node16', 'node18', 'node20', 'nodenext'];

type Options = Readonly<Record<string, unknown>>;

/**
 * "module" and "moduleResolution" of the two tsconfig files against "importExtension": without
 * an extension the compiler resolves as a bundler does, with the `node` condition, and emits
 * ECMAScript modules; with one it resolves as Node does. Under the other setting the compiler would refuse every import of the
 * project, or accept a spelling the build does not rewrite.
 */
export function compilerResolution(inspected: Inspected): Violation[] {
  const checked = compilerOptionsOf(inspected.project, TYPE_CHECK);
  const built = compilerOptionsOf(inspected.project, BUILD);
  const own = built !== undefined && written(built) !== written(checked ?? {}) ? [[BUILD, built] as const] : [];
  const read = [...(checked === undefined ? [] : [[TYPE_CHECK, checked] as const]), ...own];

  return read.flatMap(([file, options]) => (follows(inspected, options) ? [] : [unlike(inspected, file)]));
}

function written(options: Options): string {
  return JSON.stringify([options['module'], options['moduleResolution'], options['customConditions']]);
}

function follows({ project }: Inspected, options: Options): boolean {
  const module = lower(options['module']);
  const resolution = lower(options['moduleResolution']);

  if (specifierSuffix(project.config.importExtension) === '') {
    const conditions: unknown[] = Array.isArray(options['customConditions']) ? options['customConditions'] : [];

    return module === 'esnext' && resolution === 'bundler' && conditions.includes('node');
  }

  // A project written before the key existed may inherit both from a package: only a written value that contradicts it is reported.
  return [module, resolution].every((value) => value === undefined || AS_NODE.includes(value));
}

function lower(value: unknown): string | undefined {
  return typeof value === 'string' ? value.toLowerCase() : undefined;
}

function unlike({ project, report }: Inspected, file: string): Violation {
  const { importExtension } = project.config;
  const expected = compilerResolutionOf(importExtension);

  const reason =
    specifierSuffix(importExtension) === ''
      ? 'an import names its file without an extension, which the compiler only resolves as a bundler does, and the build completes the ECMAScript modules it emits with the ".js" Node needs'
      : 'an import ends with ".js", and the compiler has to resolve it as Node does to refuse any other spelling';

  const conditions =
    expected.customConditions === undefined
      ? ''
      : `, with "customConditions": ${JSON.stringify(expected.customConditions)} so that the compiler takes in a package the entry Node takes`;

  return report(
    { file, line: 1 },
    `"module" and "moduleResolution" of ${file} are not what "importExtension" gives.`,
    `Write "module": "${expected.module}" and "moduleResolution": "${expected.moduleResolution}" under "compilerOptions" in ${TYPE_CHECK}, which ${BUILD} extends${conditions}: ${reason}.`,
  );
}
