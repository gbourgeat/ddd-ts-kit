import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { isRecord } from './is-record.js';
import { jsonObject } from './json-object.js';
import { formatJson } from '../json/format-json.js';
import { agentPermissions, type AgentPermissions } from './agent-permissions.js';
import { gitHostOf } from './git-host-of.js';
import { managedSettingsNote } from './managed-settings-note.js';
import { mergeSandbox } from './merge-sandbox.js';
import { mergeHooks } from './merge-hooks.js';
import { regulatedSandbox } from './regulated-sandbox.js';

const AGENT_SETTINGS = '.claude/settings.json';

/**
 * Creates the settings, or adds the missing permissions to the ones the project already has, and
 * says which. Under the regulated profile the sandbox block and the two hooks come with them, the
 * keys the project set kept, and the managed settings the platform team pastes are said.
 */
export function writeAgentSettings(ws: Workspace, config: Config): void {
  const existing = ws.read(AGENT_SETTINGS);
  const permissions = agentPermissions(config);
  const regulated = config.agents.profile === 'regulated';

  if (existing === undefined) {
    const profile = regulated ? { sandbox: regulatedSandbox(gitHostOf(ws.root)), hooks: mergeHooks(undefined) } : {};

    ws.create(AGENT_SETTINGS, serialize({ permissions, ...profile }));
    noteManaged(ws, regulated);

    return;
  }

  const settings = jsonObject(existing);

  if (settings === undefined) {
    ws.note(`${AGENT_SETTINGS} is not a JSON object: it was left as it is.`);

    return;
  }

  const merged = mergePermissions(settings, permissions, (rule) => ws.spoken(rule));
  const sandboxed = regulated ? withSandbox(merged.settings, gitHostOf(ws.root)) : merged.settings;

  ws.update(AGENT_SETTINGS, serialize(sandboxed));

  if (merged.added.length > 0) {
    ws.note(`${AGENT_SETTINGS} gained ${merged.added.length} permission(s): ${merged.added.join(', ')}.`);
  }

  noteManaged(ws, regulated);
}

function withSandbox(settings: Record<string, unknown>, gitHost: string | undefined): Record<string, unknown> {
  return {
    ...settings,
    sandbox: mergeSandbox(settings['sandbox'], regulatedSandbox(gitHost)),
    hooks: mergeHooks(settings['hooks']),
  };
}

function noteManaged(ws: Workspace, regulated: boolean): void {
  if (regulated) {
    ws.note(managedSettingsNote());
  }
}

const serialize = (settings: unknown): string => formatJson(settings);

interface Merged {
  readonly settings: Record<string, unknown>;
  readonly added: string[];
}

/** A rule is compared as the project says it: its settings name the package manager it runs, not npm. */
function mergePermissions(
  settings: Record<string, unknown>,
  expected: AgentPermissions,
  spoken: (rule: string) => string,
): Merged {
  const current = isRecord(settings['permissions']) ? settings['permissions'] : {};
  const added: string[] = [];
  const permissions: Record<string, unknown> = { ...current };

  for (const [kind, wanted] of Object.entries(expected)) {
    const present: unknown[] = Array.isArray(current[kind]) ? current[kind] : [];
    const missing = wanted.map(spoken).filter((rule) => !present.includes(rule));

    permissions[kind] = [...present, ...missing];
    added.push(...missing.map((rule) => `${kind} ${rule}`));
  }

  return { settings: { ...settings, permissions }, added };
}
