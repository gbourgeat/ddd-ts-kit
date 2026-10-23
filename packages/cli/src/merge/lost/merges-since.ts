import { mergeOfRecord } from './merge-of-record';
import { mergeRecords } from './merge-records';
import type { MergeToVerify } from './merge-to-verify';

/** The merge commits of `<since>..HEAD`, oldest first, each on the base its trailer recorded or git computes. */
export function mergesSince(top: string, since: string): MergeToVerify[] {
  return mergeRecords(top, ['--merges', '--reverse', `${since}..HEAD`]).map((record) => mergeOfRecord(top, record, {}));
}
