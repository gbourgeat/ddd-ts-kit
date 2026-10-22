import { DEPCRUISE_FILE } from '../../depcruise/depcruise-file';
import type { Violation } from '../model/violation';
import { isRecord } from '../support/is-record';
import { ALIAS_FILES } from './alias-files';
import type { Inspected } from './inspected';
import { parseJsonc } from './parse-jsonc';
import { readProjectFile } from './read-project-file';

const { deadCode: KNIP, typeCheck: TYPE_CHECK } = ALIAS_FILES;
const READS_TSCONFIG = new RegExp(`["']?tsConfig["']?\\s*:\\s*\\{\\s*["']?fileName["']?\\s*:\\s*["']${TYPE_CHECK}["']`);

/** dependency-cruiser is told to read tsconfig; knip reads it by itself and needs no path of its own. */
export function graphTools(inspected: Inspected): Violation[] {
  return [...cruiser(inspected), ...deadCode(inspected)];
}

function cruiser({ project, report }: Inspected): Violation[] {
  const text = readProjectFile(project, DEPCRUISE_FILE);

  if (text === undefined || READS_TSCONFIG.test(text)) {
    return [];
  }

  return [
    report(
      { file: DEPCRUISE_FILE, line: 1 },
      `${DEPCRUISE_FILE} does not resolve the import alias from ${TYPE_CHECK}.`,
      `Run \`ddd-ts-kit depcruise-config --write\`: without \`tsConfig: { fileName: '${TYPE_CHECK}' }\` an alias resolves to nothing in the graph, and no boundary rule sees the import.`,
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
        `Remove the entry: knip reads the "paths" of ${TYPE_CHECK} by itself, and a second mapping is one more place to forget.`,
      ),
    );
}
