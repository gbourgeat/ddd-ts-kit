import { CONFIG_FILE } from '../../config/index.js';
import { parseJsonc } from '../alias/parse-jsonc.js';
import { readProjectFile } from '../alias/read-project-file.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import { isRecord } from '../support/is-record.js';
import { lineOf } from '../support/line-of.js';

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
