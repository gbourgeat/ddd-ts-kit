import type { Workspace } from '../workspace';
import type { BranchCommit } from './branch-commit';
import type { IncidentRecord } from './incident-record';

const FIELD = /^\s*[-*]?\s*\**(message|error_code)\**\s*:\s*(.+)$/i;

/** The record a file holds: its `message` and `error_code` lines, in a front matter or a list, and when it was first committed. */
export function incidentRecordOf(ws: Workspace, file: string, commits: readonly BranchCommit[]): IncidentRecord {
  const fields = fieldsOf(ws.read(file) ?? '');
  const first = commits.find((commit) => commit.files.includes(file));
  const message = fields.get('message');
  const errorCode = fields.get('error_code');

  return {
    file,
    at: first?.at ?? Number.MAX_SAFE_INTEGER,
    ...(message === undefined ? {} : { message }),
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}

function fieldsOf(text: string): Map<string, string> {
  const fields = new Map<string, string>();

  for (const line of text.split('\n')) {
    const [, key, value] = FIELD.exec(line) ?? [];

    if (key !== undefined && value !== undefined && !fields.has(key.toLowerCase())) {
      fields.set(key.toLowerCase(), value.trim().replace(/^[`"']|[`"']$/g, ''));
    }
  }

  return fields;
}
