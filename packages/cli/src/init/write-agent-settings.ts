import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { isRecord } from './is-record';
import { jsonObject } from './json-object';
import { formatJson } from '../json/format-json';
import { agentPermissions, GENERATED_FILES, type AgentPermissions } from './agent-permissions';
import { firstInstallNote } from './first-install-note';
import { gitHostOf } from './git-host-of';
import { managedSettingsNote } from './managed-settings-note';
import { mergeSandbox } from './merge-sandbox';
import { mergeHooks } from './merge-hooks';
import { regulatedSandbox } from './regulated-sandbox';

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
    const profile = regulated
      ? { sandbox: regulatedSandbox(gitHostOf(ws.root), config.stack), hooks: mergeHooks(undefined) }
      : {};

    ws.create(AGENT_SETTINGS, serialize({ permissions, ...profile }));
    noteManaged(ws, config);

    return;
  }

  const settings = jsonObject(existing);

  if (settings === undefined) {
    ws.note(`${AGENT_SETTINGS} is not a JSON object: it was left as it is.`);

    return;
  }

  const merged = mergePermissions(settings, permissions, (rule) => ws.spoken(rule));

  const sandboxed = regulated
    ? withSandbox(merged.settings, regulatedSandbox(gitHostOf(ws.root), config.stack))
    : merged.settings;

  ws.update(AGENT_SETTINGS, serialize(sandboxed));

  if (merged.added.length > 0) {
    ws.note(`${AGENT_SETTINGS} gained ${merged.added.length} permission(s): ${merged.added.join(', ')}.`);
  }

  if (merged.retired.length > 0) {
    ws.note(
      `${AGENT_SETTINGS} no longer denies ${merged.retired.join(', ')}: under the sandbox of Claude Code an Edit deny rule makes the path read-only for every command, docs:generate and acceptance --lock included. They are asked instead, and the guard of the plugin refuses a hand edit of them.`,
    );
  }

  noteManaged(ws, config);
}

function withSandbox(settings: Record<string, unknown>, profile: Record<string, unknown>): Record<string, unknown> {
  return { ...settings, sandbox: mergeSandbox(settings['sandbox'], profile), hooks: mergeHooks(settings['hooks']) };
}

function noteManaged(ws: Workspace, config: Config): void {
  if (config.agents.profile === 'regulated') {
    ws.note(managedSettingsNote());
    ws.note(firstInstallNote(config.stack));
  }
}

const serialize = (settings: unknown): string => formatJson(settings);

interface Merged {
  readonly settings: Record<string, unknown>;
  readonly added: string[];
  /** The deny rules of an earlier version that stopped a command of the kit under the sandbox. */
  readonly retired: string[];
}

/**
 * A rule is compared as the project says it: its settings name the package manager it runs, not
 * npm. The deny rules an earlier version wrote on the generated files leave the deny list.
 */
function mergePermissions(
  settings: Record<string, unknown>,
  expected: AgentPermissions,
  spoken: (rule: string) => string,
): Merged {
  const current = isRecord(settings['permissions']) ? settings['permissions'] : {};
  const added: string[] = [];
  const permissions: Record<string, unknown> = { ...current };
  const listed = (kind: string): unknown[] => (Array.isArray(current[kind]) ? current[kind] : []);

  const retired = listed('deny').filter(
    (rule): rule is string => typeof rule === 'string' && GENERATED_FILES.includes(rule),
  );

  for (const [kind, wanted] of Object.entries(expected)) {
    const present = listed(kind).filter((rule) => kind !== 'deny' || !retired.includes(String(rule)));
    const missing = wanted.map(spoken).filter((rule) => !present.includes(rule));

    permissions[kind] = [...present, ...missing];
    added.push(...missing.map((rule) => `${kind} ${rule}`));
  }

  return { settings: { ...settings, permissions }, added, retired };
}
