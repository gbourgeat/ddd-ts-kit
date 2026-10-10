import fs from 'node:fs';
import { SOURCE_CONDITION } from '../../alias/index.js';
import type { Violation } from '../model/violation.js';
import type { Inspected } from './inspected.js';
import { readProjectFile } from './read-project-file.js';

const RUNNER_CONFIG = /^(vitest|jest)(?:\.[\w-]+)*\.(?:config|workspace)\.[cm]?[jt]s$/;
/** A config that extends another one of the project carries what that one sets. */
const EXTENDS_ANOTHER = /from\s+['"]\.\/(?:vitest|jest)[\w.-]*['"]/;

const SETTING: Readonly<Record<string, string>> = {
  vitest: `ssr: { resolve: { conditions: ['${SOURCE_CONDITION}'] } }`,
  jest: `testEnvironmentOptions: { customExportConditions: ['${SOURCE_CONDITION}', 'node', 'node-addons'] }`,
};

/** A config of the test runner at the project root that does not set the source condition: the specs would run the compiled files. */
export function testRunners({ project, report }: Inspected): Violation[] {
  return rootFiles(project.root).flatMap((file) => {
    const runner = RUNNER_CONFIG.exec(file)?.[1];
    const text = readProjectFile(project, file) ?? '';

    if (runner === undefined || text.includes(SOURCE_CONDITION) || EXTENDS_ANOTHER.test(text)) {
      return [];
    }

    return [
      report(
        { file, line: 1 },
        `${file} does not set the condition "${SOURCE_CONDITION}".`,
        `Add \`${SETTING[runner] ?? ''}\` to the config: without it a spec that imports by an alias is answered the compiled file under dist/, stale or absent, instead of the source.`,
      ),
    ];
  });
}

function rootFiles(root: string): string[] {
  try {
    return fs.readdirSync(root).sort();
  } catch {
    return [];
  }
}
