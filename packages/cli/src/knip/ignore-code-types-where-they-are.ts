import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import { CODES_FILE } from '../context-files';
import { formatJson } from '../json/format-json';
import { codeTypesPattern } from '../refusals/code-types-pattern';
import type { Workspace } from '../workspace';

const KNIP_FILE = 'knip.json';
const ISSUES = 'ignoreIssues';

/** What became of the knip config: rewritten, already right, absent or not plain JSON. */
export type CodeTypesIgnored = 'rewritten' | 'unchanged' | 'absent' | 'unreadable';

/**
 * The code types knip is told to leave alone, named where the code lists are: at the root of each
 * context, and where 0.86 kept them as long as one context still holds a list there. Only a config
 * that already ignores the code types is touched, the patterns kept where they were among the others.
 */
export function ignoreCodeTypesWhereTheyAre(ws: Workspace, config: Config): CodeTypesIgnored {
  const text = ws.read(KNIP_FILE);
  const knip = text === undefined ? undefined : parsed(text);

  if (text === undefined || knip === undefined) {
    return text === undefined ? 'absent' : 'unreadable';
  }

  const issues = knip[ISSUES];
  const known = [codeTypesPattern(config), earlierPattern(config)];

  if (!isRecord(issues) || !Object.keys(issues).some((pattern) => known.includes(pattern))) {
    return 'unchanged';
  }

  const wanted = keepsEarlierLists(ws, config) ? known : [codeTypesPattern(config)];
  const next = { ...knip, [ISSUES]: withPatterns(issues, known, wanted) };

  if (JSON.stringify(next) === JSON.stringify(knip)) {
    return 'unchanged';
  }

  ws.update(KNIP_FILE, formatJson(next));

  return 'rewritten';
}

function earlierPattern(config: Config): string {
  return `${config.contextsDir}/*/${CODES_FILE.earlier('*')}`;
}

function keepsEarlierLists(ws: Workspace, config: Config): boolean {
  return ws
    .directories(config.contextsDir)
    .some((context) => ws.exists(`${config.contextsDir}/${context}/${CODES_FILE.earlier(context)}`));
}

/** The issues with the `wanted` patterns in place of the `known` ones, where the first of them was. */
function withPatterns(
  issues: Record<string, unknown>,
  known: readonly string[],
  wanted: readonly string[],
): Record<string, unknown> {
  const entries = Object.entries(issues);
  const at = entries.findIndex(([pattern]) => known.includes(pattern));
  const others = entries.filter(([pattern]) => !known.includes(pattern));
  const placed = wanted.map((pattern): [string, unknown] => [pattern, issues[pattern] ?? ['types']]);

  return Object.fromEntries([...others.slice(0, at), ...placed, ...others.slice(at)]);
}

function parsed(text: string): Record<string, unknown> | undefined {
  try {
    const knip: unknown = JSON.parse(text);

    return isRecord(knip) ? knip : undefined;
  } catch {
    return undefined;
  }
}
