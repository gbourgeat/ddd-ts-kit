import type { Config } from '../../config';
import { DEPCRUISE_FILE } from '../../depcruise/depcruise-file';
import { inDialect } from '../../package-manager/in-dialect';
import { BASELINE } from './baseline';
import { databaseScripts } from './database-scripts';
import { documentationScripts } from './documentation-scripts';
import { pipelineManifest } from './pipeline-manifest';
import { testScripts } from './test-scripts';

/**
 * The scripts of a project: the `ci:*` ones of the pipeline, then what a developer runs, and
 * `verify`, which chains every gate the stack has. A script that calls another does so through
 * the package manager of the project. `tracing` is where the project keeps the module `dev` preloads.
 */
export function scriptsFor(
  config: Config,
  tracing = `${config.platformDir}/observability/tracing.ts`,
): Record<string, string> {
  const written = Object.entries(scriptsOf(config, tracing));

  return Object.fromEntries(written.map(([name, script]) => [name, inDialect(script, config.stack.packageManager)]));
}

/** The module of this package that rewrites the generated declarations when it is loaded. */
const REFRESH = 'ddd-ts-kit/dist/refresh-declarations.js';

function scriptsOf(config: Config, tracing: string): Record<string, string> {
  const scripts = {
    ...pipelineManifest().scripts,
    ...runScripts(config, tracing),
    'lint:fix': 'eslint . --fix',
    'hooks:install': 'lefthook install',
    'check:arch': 'ddd-ts-kit check',
    depcruise: `ddd-ts-kit depcruise-config --check && depcruise ${config.sourceRoot} --config ${DEPCRUISE_FILE}`,
    'ci:arch:graph': 'npm run depcruise',
    deadcode: 'knip',
    quality: 'npm run format:check && npm run lint && npm run check:arch && npm run depcruise && npm run deadcode',
    ...testScripts(config),
    ...documentationScripts(config),
    // Every derived file in one step after a change: the dependency rules from the config, then what `docs:generate` writes.
    regenerate: 'ddd-ts-kit depcruise-config --write && npm run docs:generate',
    ...databaseScripts(config),
    ...privacyScripts(config),
    'infra:up': 'docker compose up -d --wait',
    'infra:down': 'docker compose down',
  };

  // Without an HTTP boundary a project has no end-to-end script: every other gate exists on every stack.
  const gates = BASELINE.map((gate) => gate.verify).filter((gate) => gate in scripts);

  return { ...scripts, verify: gates.map((gate) => `npm run ${gate}`).join(' && ') };
}

/**
 * With `--privacy on`, the two requests of a data subject, answered from the command line on the
 * sources, with the variables of `.env`: the right to erasure and the right of access, each with
 * the subject id and `--operator <who-asks>`; and the storage limitation the nightly job applies,
 * run by hand.
 */
function privacyScripts(config: Config): Record<string, string> {
  if (config.stack.privacy !== 'on') {
    return {};
  }

  return {
    'privacy:erase': 'tsx --env-file-if-exists=.env scripts/privacy-erase.ts',
    'privacy:export': 'tsx --env-file-if-exists=.env scripts/privacy-export.ts',
    'privacy:purge': 'tsx --env-file-if-exists=.env scripts/privacy-purge.ts',
  };
}

/**
 * The whole application, and the worker once the project has one (`generate worker` adds its script
 * to an existing project). `start` is plain `node` on the compiled output, whose alias specifiers
 * the build rewrote; `dev` runs the sources under tsx, which reads the `paths` of tsconfig.json.
 * In the declared style every start of `dev`, the first and each reload, begins by rewriting the
 * generated declarations: a dependency added to a constructor is injected without a manual step.
 */
function runScripts(config: Config, tracing: string): Record<string, string> {
  const compiled = `dist/${config.sourceRoot}`;
  const preloads = [`./${tracing}`, ...(config.stack.style === 'declared' ? [REFRESH] : [])];

  return {
    start: `node ${compiled}/main.js`,
    ...(config.worker ? { 'start:worker': `node ${compiled}/apps/worker/main.js` } : {}),
    dev: `tsx watch --env-file-if-exists=.env ${preloads.map((preload) => `--import ${preload}`).join(' ')} ${config.sourceRoot}/main.ts`,
  };
}
