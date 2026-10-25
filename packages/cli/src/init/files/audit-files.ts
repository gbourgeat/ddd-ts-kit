import type { Config } from '../../config';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { platformFile } from './platform-file';
import { when } from './when';

const READ_SIDE = [
  'audit.permissions.ts',
  'search-audit-entries/search-audit-entries.query.ts',
  'search-audit-entries/search-audit-entries.handler.ts',
  // What the endpoint receives and answers, out of the controller or the route, which starts with the endpoint.
  'search-audit-entries/audit-outcomes.ts',
  'search-audit-entries/audit-entries-parameters.ts',
  'search-audit-entries/audit-entries-filter-of.ts',
  'search-audit-entries/audit-entry-view.ts',
  'search-audit-entries/audit-entry-view-of.ts',
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
      [
        ...READ_SIDE,
        `search-audit-entries/search-audit-entries.${config.stack.routes === 'functions' ? 'route' : 'controller'}.ts`,
      ].map((name) => file(name)),
    ),
  ];
}
