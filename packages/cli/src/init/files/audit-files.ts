import type { Config } from '../../config/index.js';
import { familyOf } from './family-of.js';
import type { InitFile } from './init-file.js';
import { platformFile } from './platform-file.js';
import { when } from './when.js';

const READ_SIDE = [
  'audit.permissions.ts',
  'search-audit-entries.query.ts',
  'search-audit-entries.handler.ts',
  'search-audit-entries.route.ts',
];

/**
 * The audit trail and its three sources, then its read side: a protected, paginated route. It
 * lives in the platform, as a capability every context gets, and not in a bounded context.
 */
export function auditFiles(config: Config): InitFile[] {
  const { audit, http } = config.stack;
  const family = familyOf(config);
  const file = (name: string, variant?: string): InitFile => platformFile(config, `audit/${name}`, variant);

  if (audit !== 'on') {
    return [];
  }

  // On tsyringe the module also binds the store and subscribes it; by hand it only wires the read side.
  const hasModule = family === 'tsyringe' || http !== 'none';

  return [
    file('create-audit.ts'),
    file('audited-events.ts'),
    ...when(hasModule, [file('audit.module.ts', family)]),
    ...when(
      http !== 'none',
      READ_SIDE.map((name) => file(name)),
    ),
  ];
}
