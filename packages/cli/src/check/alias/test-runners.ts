import fs from 'node:fs';
import { moduleNameMapper } from '../../alias/index.js';
import type { Violation } from '../model/violation.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';
import { ALIAS_FILES } from './alias-files.js';
import type { Inspected } from './inspected.js';
import { readProjectFile } from './read-project-file.js';

const RUNNER_CONFIG = /^(vitest|jest)(?:\.[\w-]+)*\.(?:config|workspace)\.[cm]?[jt]s$/;
/** A config that extends another one of the project carries what that one sets. */
const EXTENDS_ANOTHER = /from\s+['"]\.\/(?:vitest|jest)[\w.-]*['"]/;
const READS_TSCONFIG = /\btsconfigPaths\s*:\s*true\b/;
const { typeCheck: TYPE_CHECK } = ALIAS_FILES;

/**
 * A config of the test runner at the project root that does not resolve the alias as tsconfig
 * declares it: vitest is told to read tsconfig, jest is given the same mapping, entry by entry.
 */
export function testRunners(inspected: Inspected): Violation[] {
  return rootFiles(inspected.project.root).flatMap((file) => {
    const runner = RUNNER_CONFIG.exec(file)?.[1];
    const text = readProjectFile(inspected.project, file) ?? '';

    if (runner === undefined || EXTENDS_ANOTHER.test(text)) {
      return [];
    }

    return runner === 'vitest' ? vitest(inspected, file, text) : jest(inspected, file, text);
  });
}

function vitest({ report }: Inspected, file: string, text: string): Violation[] {
  if (READS_TSCONFIG.test(text)) {
    return [];
  }

  return [
    report(
      { file, line: 1 },
      `${file} does not resolve the import alias from ${TYPE_CHECK}.`,
      `Add \`resolve: { tsconfigPaths: true }\` to the config: vitest then reads the "paths" of ${TYPE_CHECK}; without it a spec that imports by an alias fails on its first import.`,
    ),
  ];
}

function jest({ report, roots }: Inspected, file: string, text: string): Violation[] {
  return Object.entries(moduleNameMapper(roots))
    .filter(([pattern, target]) => !mapped(text, pattern, target))
    .map(([pattern, target]) => {
      const entry = `'${pattern.replaceAll('\\', '\\\\')}': '${target}'`;

      return report(
        { file, line: 1 },
        `${file} does not map the import alias "${pattern}" as ${TYPE_CHECK} declares it.`,
        `Write ${entry} under "moduleNameMapper": jest does not read tsconfig, so the mapping is repeated there, and a spec would otherwise fail on its first alias import or load another file.`,
      );
    });
}

function mapped(text: string, pattern: string, target: string): boolean {
  const written = escapeRegExp(pattern.replaceAll('\\', '\\\\'));

  return new RegExp(`['"]${written}['"]\\s*:\\s*['"]${escapeRegExp(target)}['"]`).test(text);
}

function rootFiles(root: string): string[] {
  try {
    return fs.readdirSync(root).sort();
  } catch {
    return [];
  }
}
