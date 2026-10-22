import type { Config } from '../config/index.js';
import { agentPermissions } from '../init/agent-permissions.js';
import { regulatedSandbox } from '../init/regulated-sandbox.js';
import { isRecord } from '../config/values/is-record.js';
import { inDialect } from '../package-manager/in-dialect.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The permissions of `.claude/settings.json` this version writes that the project's settings lack, and the sandbox of the regulated profile when the config asks for it. */
export function permissionFindings(config: Config, settings: unknown): DoctorFinding[] {
  return [...ruleFindings(config, settings), ...sandboxFindings(config, settings)];
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
  const expected = regulatedSandbox(undefined);

  const checks: readonly (readonly [key: string, held: boolean, expected: string])[] = [
    ['enabled', sandbox['enabled'] === true, 'true'],
    ['failIfUnavailable', sandbox['failIfUnavailable'] === true, 'true'],
    ['allowUnsandboxedCommands', sandbox['allowUnsandboxedCommands'] === false, 'false'],
    ['network.allowedDomains', listed(sandbox['network'], 'allowedDomains'), 'the npm registry and the git host'],
    ['credentials.files', listed(sandbox['credentials'], 'files'), `${count(expected, 'credentials', 'files')} denied`],
    [
      'credentials.envVars',
      listed(sandbox['credentials'], 'envVars'),
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

function count(block: Record<string, unknown>, ...keys: readonly string[]): number {
  const value = keys.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), block);

  return Array.isArray(value) ? value.length : 0;
}
