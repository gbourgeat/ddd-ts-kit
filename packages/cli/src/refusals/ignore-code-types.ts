import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import { formatJson } from '../json/format-json';
import { codeTypesPattern } from './code-types-pattern';
import type { MigrationDraft } from './migration-draft';

const KNIP_FILE = 'knip.json';
const ISSUES = 'ignoreIssues';

/**
 * knip reports the type `<Ctx>Code` of each `<context>.codes.ts` that nothing imports yet, though it is the
 * contract a route or a client reads: `init` tells knip so under the named form, and the migration
 * says it as `init` does. A knip config the migration cannot edit (another file, or not plain
 * JSON) is left to a person.
 */
export function ignoreCodeTypes(config: Config, draft: MigrationDraft): void {
  const pattern = codeTypesPattern(config);
  const text = draft.read(KNIP_FILE);
  const knip = text === undefined ? undefined : parsed(text);

  if (knip !== undefined) {
    if (!ignores(knip, pattern)) {
      draft.write(KNIP_FILE, formatJson(withCodeTypes(knip, pattern)));
    }

    return;
  }

  if (text !== undefined || /"knip"/.test(draft.read('package.json') ?? '')) {
    draft.manual.push(
      `Tell knip that the code types are a contract: add \`"${ISSUES}": { "${pattern}": ["types"] }\` to its config.`,
    );
  }
}

function parsed(text: string): Record<string, unknown> | undefined {
  try {
    const knip: unknown = JSON.parse(text);

    return isRecord(knip) ? knip : undefined;
  } catch {
    return undefined;
  }
}

function ignores(knip: Record<string, unknown>, pattern: string): boolean {
  const issues = knip[ISSUES];
  const kinds = isRecord(issues) ? issues[pattern] : undefined;

  return Array.isArray(kinds) && kinds.includes('types');
}

/** The config with the types of `pattern` ignored, placed where `init` writes them: after `ignoreExportsUsedInFile`. */
function withCodeTypes(knip: Record<string, unknown>, pattern: string): Record<string, unknown> {
  const issues = isRecord(knip[ISSUES]) ? knip[ISSUES] : {};
  const kinds = issues[pattern];
  const listed: unknown[] = Array.isArray(kinds) ? kinds : [];
  const ignored = { ...issues, [pattern]: [...listed, 'types'] };

  if (knip[ISSUES] !== undefined) {
    return { ...knip, [ISSUES]: ignored };
  }

  const entries = Object.entries(knip);
  const after = entries.findIndex(([key]) => key === 'ignoreExportsUsedInFile');
  const at = after === -1 ? entries.length : after + 1;

  return Object.fromEntries([...entries.slice(0, at), [ISSUES, ignored], ...entries.slice(at)]);
}
