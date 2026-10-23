import type { Workspace } from '../workspace';
import { SLICES_FILE } from './read-slices';
import { RULE_LINE } from './rule-line';

/**
 * The rules written for each row of the slices file, by row id, as the plan-slices skill writes
 * them under the tables. A row with several lines gets them joined with `; `. Ids are text:
 * `4.15` and `D4.01` are kept as written.
 */
export function readSliceRules(ws: Workspace): ReadonlyMap<string, string> {
  const rules = new Map<string, string>();

  for (const line of (ws.read(SLICES_FILE) ?? '').split('\n')) {
    const [, id, text] = RULE_LINE.exec(line) ?? [];

    if (id !== undefined && text !== undefined) {
      const present = rules.get(id);

      rules.set(id, present === undefined ? text : `${present}; ${text}`);
    }
  }

  return rules;
}
