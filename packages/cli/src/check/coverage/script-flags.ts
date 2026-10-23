import { CONFIG_FILE } from '../../config';
import { parseJsonc } from '../alias/parse-jsonc';
import { readProjectFile } from '../alias/read-project-file';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import { isRecord } from '../support/is-record';
import { lineOf } from '../support/line-of';

const MANIFEST = 'package.json';

/** A flag of the test runner that changes what a coverage run measures or the floor it is held to. */
const FLAG =
  /--(coverage\.(?:include|exclude|thresholds|ignoreClassMethods)|collectCoverageFrom|coveragePathIgnorePatterns|coverageThreshold)\b/;

export interface ScriptFinding extends Finding {
  readonly file: string;
}

/** The scripts of the manifest that set by a flag what the config file governs. */
export function scriptFlags(project: Project): ScriptFinding[] {
  const text = readProjectFile(project, MANIFEST);
  const manifest = text === undefined ? undefined : parseJsonc(text);
  const scripts = manifest !== undefined && isRecord(manifest['scripts']) ? manifest['scripts'] : {};

  return Object.entries(scripts).flatMap(([name, command]) => {
    const flag = typeof command === 'string' ? FLAG.exec(command)?.[1] : undefined;

    if (flag === undefined) {
      return [];
    }

    return [
      {
        file: MANIFEST,
        line: lineOf(text ?? '', `"${name}"`),
        message: `The script "${name}" sets "--${flag}" by hand: it changes what the coverage run measures or the floor it is held to.`,
        fix: `Remove the flag: what is measured and the floor of each layer come from the "coverage" key of ${CONFIG_FILE} alone.`,
      },
    ];
  });
}
