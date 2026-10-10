import { parseConfig } from '../../config/index.js';

/** The config of the two contexts of the fixtures, with what a fixture changes over it. */
export function config(overrides: Record<string, unknown> = {}): string {
  const written = {
    contexts: {
      billing: { classification: 'core', upstreams: [{ context: 'catalog', relationship: 'published-language' }] },
      catalog: { classification: 'supporting', upstreams: [] },
    },
    ...overrides,
  };

  return JSON.stringify({ deviations: recordedRelaxations(written), ...written }, null, 2);
}

/** Unless a fixture writes its own `deviations`, the severities, guard mode and directories it changes are recorded. */
function recordedRelaxations(written: Record<string, unknown>): { what: string; adr: string; reason: string }[] {
  const { rules, guard, contexts } = parseConfig(written);

  const relaxed = [
    ...Object.keys(rules).map((id) => `rules.${id}`),
    ...(guard === 'enforce' ? [] : ['guard']),
    ...Object.entries(contexts).flatMap(([name, context]) => context.extraDirectories.map((directory) => `contexts.${name}.extraDirectories.${directory}`)),
  ];

  return relaxed.map((what) => ({ what, adr: '0001', reason: 'Needed by the fixture.' }));
}
