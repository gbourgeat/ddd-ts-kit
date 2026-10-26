import { CONFIG_FILE } from '../../config';
import { renderTemplate } from '../../templating';
import type { Kind } from '../kind';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { applyWiring } from '../apply-wiring';
import { vars } from '../vars';
import { wiringFamily } from '../wiring-family';
import { addComposeService } from './extraction/add-compose-service';
import { editJson } from './extraction/edit-json';
import { EntryPoint } from './extraction/entry-point';
import { recordOf } from './extraction/record-of';
import { serviceSelection } from './extraction/service-selection';

const HOSTING_PROOF = 'test/architecture/hosting.spec.ts';

export const serviceKind: Kind = {
  name: 'service',
  aliases: [],
  usage: 'service <context>',
  summary:
    'The context run alone, with its scheduled jobs: its entry point under apps/, a start script, a compose service, `deployable` in the config, and a proof that it registers no job of the platform.',
  positionals: ['context'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);
    const { ws, config, context } = scope;
    const entry = new EntryPoint(config, context.kebab);
    const service = { ...serviceSelection(scope), portVariable: `{${context.constant}_PORT:-3001}` };

    ws.create(entry.source, renderTemplate('service/main.ts.tpl', vars(scope, { service })));
    entry.declareIn(ws);
    editJson(ws, CONFIG_FILE, (raw) => markDeployable(raw, context.kebab));
    addComposeService(ws, context.kebab, renderTemplate('service/compose.tpl', vars(scope, { service })));
    proveTheService(scope);

    ws.note(
      `Build the image of the service with \`docker build --build-arg ENTRY=${entry.compiled} .\`, or start it with \`docker compose --profile services up ${context.kebab}\`.`,
    );

    ws.note(
      `The service takes the scheduled jobs of ${context.kebab} with it: it runs them unless RUN_JOBS=false, and no job of another context nor of the platform (audit.archive, privacy.purge-expired stay with the whole application).`,
    );

    ws.note(
      'Set the same DEPLOYMENT_NAME in every container of the deployment (the keys of the lock, the cache and the job store), and a different OTEL_SERVICE_NAME for each (the traces).',
    );
  },
};

/** A proof composes the root of the service and checks that it registers no job of the platform. */
function proveTheService(scope: Scope): void {
  const { ws, config } = scope;
  const rendered = vars(scope, {});

  if (!ws.exists(HOSTING_PROOF)) {
    ws.create(HOSTING_PROOF, renderTemplate(`architecture/hosting.${wiringFamily(config)}.spec.ts.tpl`, rendered));
  }

  applyWiring(ws, HOSTING_PROOF, renderTemplate('service/extracted-name.tpl', rendered));
}

function markDeployable(raw: Record<string, unknown>, context: string): void {
  const contexts = recordOf(raw['contexts']);

  raw['contexts'] = { ...contexts, [context]: { ...recordOf(contexts[context]), deployable: true } };
}
