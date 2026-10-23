import type { Workspace } from '../workspace/index.js';
import type { BranchCommit } from './branch-commit.js';
import type { IncidentRecord } from './incident-record.js';
import { incidentRecordOf } from './incident-record-of.js';

const INCIDENTS_DIR = 'docs/architecture/incidents';

/**
 * The earlier incident record with the same `message` or `error_code` as `file`, read from
 * `docs/architecture/incidents/`; undefined when there is none, or when `file` is not a record.
 */
export function repeatedIncident(ws: Workspace, file: string, commits: readonly BranchCommit[]): string | undefined {
  const records = ws
    .list(INCIDENTS_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => incidentRecordOf(ws, `${INCIDENTS_DIR}/${name}`, commits));

  const own = records.find((record) => record.file === file);

  if (own === undefined) {
    return undefined;
  }

  return records
    .filter((record) => record.file !== own.file && record.at <= own.at && sameAs(record, own))
    .sort((left, right) => left.at - right.at || left.file.localeCompare(right.file))[0]?.file;
}

function sameAs(left: IncidentRecord, right: IncidentRecord): boolean {
  return (
    (left.errorCode !== undefined && left.errorCode === right.errorCode) ||
    (left.message !== undefined && left.message === right.message)
  );
}
