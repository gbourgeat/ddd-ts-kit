import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { contextDoc } from './context-doc';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';

const { BILLING } = PATHS;

/** Billing divided into the modules of its model named here, each with the row of its purpose unless left out. */
export function withModules(
  modules: Readonly<Record<string, object>>,
  rows: readonly string[] = Object.keys(modules),
  style: 'explicit' | 'declared' = 'explicit',
): FixtureFiles {
  const table = rows.map((module) => `| \`${module}\` | What the ${module} hold. |`).join('\n');

  return {
    [CONFIG_FILE]: config({
      contexts: {
        billing: { classification: 'core', upstreams: ['catalog'], modules },
        catalog: { classification: 'supporting', upstreams: [] },
      },
      ...(style === 'declared' ? { stack: { style: 'declared' } } : {}),
    }),
    [`${BILLING}/CONTEXT.md`]:
      rows.length === 0
        ? contextDoc('core')
        : `${contextDoc('core')}\n## Modules\n\n| Module | Purpose |\n|---|---|\n${table}\n`,
  };
}
