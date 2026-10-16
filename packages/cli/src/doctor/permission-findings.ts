import type { Config } from '../config/index.js';
import { AGENT_PERMISSIONS } from '../init/agent-permissions.js';
import { isRecord } from '../config/values/is-record.js';
import { inDialect } from '../package-manager/in-dialect.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The permissions of `.claude/settings.json` this version writes that the project's settings lack. */
export function permissionFindings(config: Config, settings: unknown): DoctorFinding[] {
  const permissions = isRecord(settings) && isRecord(settings['permissions']) ? settings['permissions'] : {};

  return Object.entries(AGENT_PERMISSIONS).flatMap(([kind, rules]) => {
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
