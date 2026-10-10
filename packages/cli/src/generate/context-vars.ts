import type { Config } from '../config/index.js';
import type { Name } from '../naming/index.js';
import type { RenderContext } from '../templating/index.js';
import { stackVars } from '../stack/stack-vars.js';
import { named } from './named.js';
import { relativeTo } from './relative-to.js';
import { storageVars } from './storage-vars.js';

/** What every template of a context reads: the stack, the context and the paths between its folders and the rest of the project. */
export function contextVars(config: Config, context: Name): RenderContext {
  const dir = `${config.contextsDir}/${context.kebab}`;

  return {
    ...stackVars(config),
    context: { ...named(context), schema: context.kebab.replaceAll('-', '_') },
    storage: storageVars(config, dir),
    paths: { ...pathVars(config, dir), appToSource: relativeTo(`${config.sourceRoot}/apps/${context.kebab}`, config.sourceRoot) },
  };
}

function pathVars(config: Config, dir: string): RenderContext {
  const { platformDir, contextsDir, sourceRoot } = config;

  return {
    contextToPlatform: relativeTo(dir, platformDir),
    persistenceToPlatform: relativeTo(`${dir}/infrastructure/persistence`, platformDir),
    integrationToPlatform: relativeTo(`${dir}/test/integration`, platformDir),
    platformToContexts: relativeTo(platformDir, contextsDir),
    databaseToContexts: relativeTo(`${platformDir}/database`, contextsDir),
    persistenceToGenerated: relativeTo(`${dir}/infrastructure/persistence`, 'generated'),
    scriptsToSource: relativeTo('scripts', sourceRoot),
    e2eToSource: relativeTo('test/e2e', sourceRoot),
    authorizationToPlatform: relativeTo(`${dir}/application/authorization`, platformDir),
    authToContexts: relativeTo(`${platformDir}/auth`, contextsDir),
    auditToContexts: relativeTo(`${platformDir}/audit`, contextsDir),
    architectureToSource: relativeTo('test/architecture', sourceRoot),
  };
}
