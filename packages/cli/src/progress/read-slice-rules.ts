import type { Workspace } from '../workspace/index.js';
import { SLICES_FILE } from './read-slices.js';

/**
 * A rule line of the slices file, anywhere outside a table: `- #<row>: <invariants and failures
 * by name>`, or `- <row>: ..` without the `#`, as a plan written by hand often has it. A list item
 * whose first word is not the id of a row gives a rule no row asks for.
 */
const RULE_LINE = /^\s*[-*]\s+#?([^\s:,#]+)\s*:\s*(.+?)\s*$/;

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
