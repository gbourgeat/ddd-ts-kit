import type { Config } from '../config/index.js';
import { packageManagerVars } from '../package-manager/package-manager-vars.js';
import { stackVars } from '../stack/stack-vars.js';
import { WITH_DATABASE } from '../stack/with-database.js';
import { AGENT_INSTRUCTION } from '../sdk/agent-instruction.js';
import type { RenderContext } from '../templating/index.js';
import { knipVars } from './knip-vars.js';

/** The Keycloak release the compose service runs and the realm file was written and imported for. */
const KEYCLOAK_VERSION = '26.8.0';

/** What the templates of `init` read: the variables of the stack, then the ones only a new project needs. */
export function templateVars(config: Config, projectName: string): RenderContext {
  const { database, docsUi, ci, cache, broker, errors } = config.stack;

  return {
    ...stackVars(config),
    project: { name: projectName },
    pm: packageManagerVars(config),
    docs: { any: docsUi !== 'none', ui: docsUi },
    knip: knipVars(config),
    ci: { github: ci === 'github' || ci === 'both', gitlab: ci === 'gitlab' || ci === 'both', any: ci !== 'none' },
    extras: extrasVars(config.ci.extras),
    needs: { url: readsUrl(config), text: readsText(config) },
    keycloak: { version: KEYCLOAK_VERSION },
    sdk: { on: config.sdk !== undefined, instruction: AGENT_INSTRUCTION },
    compose: {
      volumes:
        database === 'postgres' ||
        database === 'mysql' ||
        cache === 'redis' ||
        ['redis', 'nats'].includes(broker) ||
        errors === 'sentry',
    },
    database: {
      postgres: database === 'postgres',
      mysql: database === 'mysql',
      sqlite: database === 'sqlite',
      server: database === 'postgres' || database === 'mysql',
    },
  };
}

/** The extra jobs of the pipeline, by the name a template asks for. */
function extrasVars(extras: readonly string[]): RenderContext {
  const gitlab = ['gitlab-sast', 'gitlab-secret-detection', 'gitlab-dependency-scanning'];

  return {
    codeql: extras.includes('codeql'),
    dependencyReview: extras.includes('dependency-review'),
    gitlabSast: extras.includes('gitlab-sast'),
    gitlabSecretDetection: extras.includes('gitlab-secret-detection'),
    gitlabDependencyScanning: extras.includes('gitlab-dependency-scanning'),
    gitlabSecurity: extras.some((extra) => gitlab.includes(extra)),
    none: extras.length === 0,
  };
}

/** Whether the validated configuration holds at least one URL: the reader of URLs is written only then. */
function readsUrl(config: Config): boolean {
  const { orm, broker, cache, httpCache } = config.stack;

  return (
    httpCache === 'varnish' ||
    WITH_DATABASE.includes(orm) ||
    verifiesTokens(config) ||
    ['rabbitmq', 'nats', 'redis'].includes(broker) ||
    cache === 'redis'
  );
}

/** Whether the validated configuration holds a required text that is not a URL: the names a token is checked against, a list of brokers. */
function readsText(config: Config): boolean {
  return verifiesTokens(config) || config.stack.broker === 'kafka' || config.stack.httpCache === 'varnish';
}

function verifiesTokens(config: Config): boolean {
  const { authn, http } = config.stack;

  return (authn === 'jwt' || authn === 'keycloak') && http !== 'none';
}
