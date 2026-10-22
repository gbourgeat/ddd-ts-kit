import type { Config } from '../../config';

export function documentationScripts(config: Config): Record<string, string> {
  const hasHttp = config.stack.http !== 'none';
  const generated = [...(hasHttp ? ['node dist/scripts/openapi.js'] : []), 'node dist/scripts/events.js'];

  const openApi = {
    'openapi:generate': 'npm run build && node dist/scripts/openapi.js',
    'openapi:check': 'npm run build && node dist/scripts/openapi.js --check',
  };

  return {
    ...(hasHttp ? openApi : {}),
    // The pipeline builds once: its documents job compares them from the build the step before it made.
    'ci:docs': `ddd-ts-kit docs --check && ${generated.map((command) => `${command} --check`).join(' && ')}`,
    'events:generate': 'npm run build && node dist/scripts/events.js',
    'events:check': 'npm run build && node dist/scripts/events.js --check',
    'docs:generate': `ddd-ts-kit docs && npm run build && ${generated.join(' && ')}`,
    'docs:check': `ddd-ts-kit docs --check && npm run build && ${generated.map((command) => `${command} --check`).join(' && ')}`,
  };
}
