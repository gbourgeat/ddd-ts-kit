import type { Config } from '../../config/index.js';
import { DEPCRUISE_FILE } from '../../depcruise/depcruise-file.js';
import { databaseScripts } from './database-scripts.js';
import { documentationScripts } from './documentation-scripts.js';
import { pipelineManifest } from './pipeline-manifest.js';
import { testScripts } from './test-scripts.js';

const GATES = [
  'typecheck',
  'lint',
  'format:check',
  'test',
  'test:e2e',
  'check:arch',
  'depcruise',
  'deadcode',
  'docs:check',
];

/** The scripts of a project: the `ci:*` ones of the pipeline, then what a developer runs, and `verify`, which chains every gate the stack has. */
export function scriptsFor(config: Config): Record<string, string> {
  const scripts = {
    ...pipelineManifest().scripts,
    ...runScripts(config),
    'lint:fix': 'eslint . --fix',
    'hooks:install': 'lefthook install',
    'check:arch': 'ddd-ts-kit check',
    depcruise: `ddd-ts-kit depcruise-config --check && depcruise ${config.sourceRoot} --config ${DEPCRUISE_FILE}`,
    'ci:arch:graph': 'npm run depcruise',
    deadcode: 'knip',
    quality: 'npm run format:check && npm run lint && npm run check:arch && npm run depcruise && npm run deadcode',
    ...testScripts(config),
    ...documentationScripts(config),
    ...databaseScripts(config),
    'infra:up': 'docker compose up -d --wait',
    'infra:down': 'docker compose down',
  };

  const gates = GATES.filter((gate) => gate in scripts);

  return { ...scripts, verify: gates.map((gate) => `npm run ${gate}`).join(' && ') };
}

/** The whole application, and the worker once the project has one (`generate worker` adds its script to an existing project). */
function runScripts(config: Config): Record<string, string> {
  const compiled = `dist/${config.sourceRoot}`;

  return {
    start: `node ${compiled}/main.js`,
    ...(config.worker ? { 'start:worker': `node ${compiled}/apps/worker/main.js` } : {}),
    dev: `tsx watch --env-file-if-exists=.env --import ./${config.platformDir}/tracing.ts ${config.sourceRoot}/main.ts`,
  };
}
