import type { Config } from '../config';
import { agentPermissions } from '../init/agent-permissions';
import { hookCommand } from '../init/hook-command';
import { PROFILE_HOOKS } from '../init/profile-hooks';
import { registeredHookCommands } from '../init/registered-hook-commands';
import { regulatedSandbox } from '../init/regulated-sandbox';
import { stackSandbox } from '../init/stack-sandbox';
import { isRecord } from '../config/values/is-record';
import { inDialect } from '../package-manager/in-dialect';
import type { DoctorFinding } from './doctor-finding';

/** The permissions of `.claude/settings.json` this version writes that the project's settings lack, and the sandbox and the hooks of the regulated profile when the config asks for it. */
export function permissionFindings(config: Config, settings: unknown): DoctorFinding[] {
  return [
    ...ruleFindings(config, settings),
    ...sandboxFindings(config, settings),
    ...hookFindings(config, settings),
    ...openGateFindings(config, settings),
  ];
}

/** Under the regulated profile, a mode that skips the permission prompts or a rule that allows every command: no gate is left. */
function openGateFindings(config: Config, settings: unknown): DoctorFinding[] {
  if (config.agents.profile !== 'regulated') {
    return [];
  }

  const permissions = isRecord(settings) && isRecord(settings['permissions']) ? settings['permissions'] : {};
  const allowed: readonly unknown[] = Array.isArray(permissions['allow']) ? permissions['allow'] : [];
  const open = allowed.find((rule) => rule === 'Bash(*)' || rule === 'Bash');

  return [
    ...(permissions['defaultMode'] === 'bypassPermissions'
      ? [
          {
            area: 'permission',
            name: 'permissions.defaultMode',
            problem: 'written otherwise',
            expected: 'a mode that asks, as the regulated profile has no gate left under bypassPermissions',
            found: 'bypassPermissions',
          } satisfies DoctorFinding,
        ]
      : []),
    ...(open === undefined
      ? []
      : [
          {
            area: 'permission',
            name: 'permissions.allow',
            problem: 'written otherwise',
            expected:
              'commands allowed one by one, as the regulated profile has no gate left under a rule for every command',
            found: open,
          } satisfies DoctorFinding,
        ]),
  ];
}

/** Under the regulated profile, each hook of the profile the settings do not register under `PreToolUse`. */
function hookFindings(config: Config, settings: unknown): DoctorFinding[] {
  if (config.agents.profile !== 'regulated') {
    return [];
  }

  const hooks = isRecord(settings) && isRecord(settings['hooks']) ? settings['hooks'] : {};
  const registered = registeredHookCommands(hooks['PreToolUse']);

  return PROFILE_HOOKS.filter((hook) => !registered.includes(hookCommand(hook))).map((hook) => ({
    area: 'permission',
    name: `hooks.${hook.name}`,
    problem: 'missing',
    expected: `a PreToolUse hook on ${hook.matcher} running ${hookCommand(hook)}`,
  }));
}

function ruleFindings(config: Config, settings: unknown): DoctorFinding[] {
  const permissions = isRecord(settings) && isRecord(settings['permissions']) ? settings['permissions'] : {};

  return Object.entries(agentPermissions(config)).flatMap(([kind, rules]) => {
    const present: unknown = permissions[kind];
    const held = Array.isArray(present) ? present : [];

    return rules
      .map((rule) => inDialect(rule, config.stack.packageManager))
      .filter((rule) => !held.includes(rule))
      .map(
        (rule): DoctorFinding => ({ area: 'permission', name: `${kind} ${rule}`, problem: 'missing', expected: rule }),
      );
  });
}

/** Under the regulated profile, each key of the sandbox block the settings lack or set otherwise than the profile writes it. */
function sandboxFindings(config: Config, settings: unknown): DoctorFinding[] {
  if (config.agents.profile !== 'regulated') {
    return [];
  }

  const sandbox = isRecord(settings) && isRecord(settings['sandbox']) ? settings['sandbox'] : {};
  const expected = regulatedSandbox(undefined, config.stack);
  const install = stackSandbox(config.stack);
  const hosts = ['the npm registry', 'the git host', ...install.hosts];

  const checks: readonly (readonly [key: string, held: boolean, expected: string])[] = [
    ['enabled', sandbox['enabled'] === true, 'true'],
    ['failIfUnavailable', sandbox['failIfUnavailable'] === true, 'true'],
    ['allowUnsandboxedCommands', sandbox['allowUnsandboxedCommands'] === false, 'false'],
    ['autoAllowBashIfSandboxed', sandbox['autoAllowBashIfSandboxed'] === false, 'false'],
    ['filesystem.allowWrite', holds(sandbox['filesystem'], 'allowWrite', install.writes), install.writes.join(', ')],
    [
      'network.allowedDomains',
      listed(sandbox['network'], 'allowedDomains') &&
        holds(sandbox['network'], 'allowedDomains', install.hosts) &&
        !holdsAny(sandbox['network'], 'allowedDomains', ['*']),
      `${hosts.slice(0, -1).join(', ')} and ${hosts.at(-1) ?? ''}`,
    ],
    [
      'credentials.files',
      holdsEntries(sandbox['credentials'], 'files', expected),
      `${count(expected, 'credentials', 'files')} denied`,
    ],
    [
      'credentials.envVars',
      holdsEntries(sandbox['credentials'], 'envVars', expected),
      `${count(expected, 'credentials', 'envVars')} denied`,
    ],
  ];

  return checks
    .filter(([, held]) => !held)
    .map(([key, , wanted]) => ({ area: 'permission', name: `sandbox.${key}`, problem: 'missing', expected: wanted }));
}

function listed(block: unknown, key: string): boolean {
  const value = isRecord(block) ? block[key] : undefined;

  return Array.isArray(value) && value.length > 0;
}

/** Every entry the stack needs is in the list: a project may list more. */
function holds(block: unknown, key: string, wanted: readonly string[]): boolean {
  const value = isRecord(block) ? block[key] : undefined;

  return Array.isArray(value) && wanted.every((entry) => value.includes(entry));
}

/** The list holds one of the entries: a wildcard host lets every host through. */
function holdsAny(block: unknown, key: string, entries: readonly string[]): boolean {
  const value = isRecord(block) ? block[key] : undefined;

  return Array.isArray(value) && entries.some((entry) => value.includes(entry));
}

/** The list of `sandbox.credentials` holds every entry the profile writes: a project may list more. */
function holdsEntries(block: unknown, key: string, expected: Record<string, unknown>): boolean {
  const value = isRecord(block) ? block[key] : undefined;
  const wanted = (isRecord(expected['credentials']) ? expected['credentials'][key] : undefined) ?? [];

  return (
    Array.isArray(value) &&
    Array.isArray(wanted) &&
    wanted.every((entry) => value.some((held) => sameEntry(held, entry)))
  );
}

/** Two entries of a credentials list name the same path or variable with the same mode. */
function sameEntry(held: unknown, wanted: unknown): boolean {
  if (!isRecord(held) || !isRecord(wanted)) {
    return false;
  }

  return held['path'] === wanted['path'] && held['name'] === wanted['name'] && held['mode'] === wanted['mode'];
}

function count(block: Record<string, unknown>, ...keys: readonly string[]): number {
  const value = keys.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), block);

  return Array.isArray(value) ? value.length : 0;
}
