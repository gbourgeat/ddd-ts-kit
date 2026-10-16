import type { Workspace } from '../workspace/index.js';
import { isRecord } from './is-record.js';
import { jsonObject } from './json-object.js';
import { formatJson } from '../json/format-json.js';
import { AGENT_PERMISSIONS as PERMISSIONS } from './agent-permissions.js';

const AGENT_SETTINGS = '.claude/settings.json';

/** Creates the settings, or adds the missing permissions to the ones the project already has, and says which. */
export function writeAgentSettings(ws: Workspace): void {
  const existing = ws.read(AGENT_SETTINGS);

  if (existing === undefined) {
    ws.create(AGENT_SETTINGS, serialize({ permissions: PERMISSIONS }));

    return;
  }

  const settings = jsonObject(existing);

  if (settings === undefined) {
    ws.note(`${AGENT_SETTINGS} is not a JSON object: it was left as it is.`);

    return;
  }

  const merged = mergePermissions(settings, (rule) => ws.spoken(rule));

  ws.update(AGENT_SETTINGS, serialize(merged.settings));

  if (merged.added.length > 0) {
    ws.note(`${AGENT_SETTINGS} gained ${merged.added.length} permission(s): ${merged.added.join(', ')}.`);
  }
}

const serialize = (settings: unknown): string => formatJson(settings);

interface Merged {
  readonly settings: Record<string, unknown>;
  readonly added: string[];
}

/** A rule is compared as the project says it: its settings name the package manager it runs, not npm. */
function mergePermissions(settings: Record<string, unknown>, spoken: (rule: string) => string): Merged {
  const current = isRecord(settings['permissions']) ? settings['permissions'] : {};
  const added: string[] = [];
  const permissions: Record<string, unknown> = { ...current };

  for (const [kind, wanted] of Object.entries(PERMISSIONS)) {
    const present: unknown[] = Array.isArray(current[kind]) ? current[kind] : [];
    const missing = wanted.map(spoken).filter((rule) => !present.includes(rule));

    permissions[kind] = [...present, ...missing];
    added.push(...missing.map((rule) => `${kind} ${rule}`));
  }

  return { settings: { ...settings, permissions }, added };
}
