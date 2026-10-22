import fs from 'node:fs';
import path from 'node:path';
import { jsonObject } from '../init/json-object';
import { VERIFICATION_FILE } from '../slice/verification-file';
import type { ProgressVerification } from './worker-progress';

/** What the worker's slice looks like now: the commit checked out and when each file of the slice last changed. */
export interface SliceNow {
  readonly head: string | undefined;
  readonly changed: readonly number[];
}

/** The last `verify-slice` of the worker at `project`, with what changed after it; null when it ran none there. */
export function readVerification(project: string, now: SliceNow): ProgressVerification | null {
  const file = path.join(project, VERIFICATION_FILE);
  const json = fs.existsSync(file) ? jsonObject(fs.readFileSync(file, 'utf8')) : undefined;
  const at = json?.['at'];

  if (json === undefined || typeof at !== 'string') {
    return null;
  }

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

  const head = typeof json['head'] === 'string' ? json['head'] : null;

  return {
    at,
    head,
    row: typeof json['row'] === 'string' ? json['row'] : null,
    ok: json['ok'] === true,
    failed: strings(json['failed']),
    toStage: strings(json['toStage']),
    changedAfter: now.changed.filter((time) => time > Date.parse(at)).length,
    committedAfter: head !== null && now.head !== undefined && head !== now.head,
  };
}
