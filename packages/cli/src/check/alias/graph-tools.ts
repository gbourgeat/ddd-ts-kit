import { SOURCE_CONDITION } from '../../alias/index.js';
import { DEPCRUISE_FILE } from '../../depcruise/depcruise-file.js';
import type { Violation } from '../model/violation.js';
import { isRecord } from '../support/is-record.js';
import { ALIAS_FILES } from './alias-files.js';
import type { Inspected } from './inspected.js';
import { parseJsonc } from './parse-jsonc.js';
import { readProjectFile } from './read-project-file.js';

const { deadCode: KNIP, manifest: MANIFEST } = ALIAS_FILES;

/** dependency-cruiser needs the source condition to follow an alias to a source; knip reads package.json and needs no path of its own. */
export function graphTools(inspected: Inspected): Violation[] {
  return [...cruiser(inspected), ...deadCode(inspected)];
}

function cruiser({ project, report }: Inspected): Violation[] {
  const text = readProjectFile(project, DEPCRUISE_FILE);

  if (text === undefined || text.includes(SOURCE_CONDITION)) {
    return [];
  }

  return [
    report(
      { file: DEPCRUISE_FILE, line: 1 },
      `${DEPCRUISE_FILE} does not resolve under the condition "${SOURCE_CONDITION}".`,
      'Run `ddd-ts-kit depcruise-config --write`: without the condition the graph follows an alias to the compiled files, which are excluded, and no boundary rule sees the import.',
    ),
  ];
}

function deadCode({ project, report, roots }: Inspected): Violation[] {
  const written = parseJsonc(readProjectFile(project, KNIP) ?? '');
  const paths = written !== undefined && isRecord(written['paths']) ? Object.keys(written['paths']) : [];

  return paths
    .filter((key) => roots.some(({ prefix }) => key.startsWith(prefix)))
    .map((key) =>
      report(
        { file: KNIP, line: 1 },
        `${KNIP} maps "${key}" under "paths".`,
        `Remove the entry: knip resolves an alias from the "imports" of ${MANIFEST}, like every other tool.`,
      ),
    );
}
