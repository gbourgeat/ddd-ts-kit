import { CONFIG_FILE } from '../../config';
import { inertPersistenceFile } from '../../init/files/inert-persistence-file';
import { renderTemplate } from '../../templating';
import type { Kind } from '../kind';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { applyWiring } from '../apply-wiring';
import { platformPath } from '../platform-path';
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
    'The context run alone, with its scheduled jobs: its entry point under apps/, a start script, a compose service, `deployable` in the config, and its departure from the whole application (consumers, processes and jobs run once).',
  positionals: ['context'],
  writesShared: true,
  writesInModules: false,
  run: (request) => {
    const scope = openScope(request);
    const { ws, config, context } = scope;
    const entry = new EntryPoint(config, context.kebab);
    const service = { ...serviceSelection(scope), portVariable: `\${${context.constant}_PORT:-3001}` };

    ws.create(entry.source, renderTemplate('service/main.ts.tpl', vars(scope, { service })));
    entry.declareIn(ws);
    editJson(ws, CONFIG_FILE, (raw) => markDeployable(raw, context.kebab));
    addComposeService(ws, context.kebab, renderTemplate('service/compose.tpl', vars(scope, { service })));
    leaveTheWholeApplication(scope);

    ws.note(
      `Build the image of the service with \`docker build --build-arg ENTRY=${entry.compiled} .\`, or start it with \`docker compose --profile services up ${context.kebab}\`.`,
    );

    ws.note(
      `The service takes the scheduled jobs of ${context.kebab} with it: it runs them unless RUN_JOBS=false, and no job of another context nor of the platform (audit.archive, privacy.purge-expired stay with the whole application).`,
    );

    ws.note(
      `${context.pascal} leaves the application of src/main.ts and the worker: \`hostedContexts\` of the composition root omits it, so its consumers, its processes, its jobs and its routes run in the service only. \`everyContext\` stays the full list for the contracts and the end-to-end tests. Set the same DEPLOYMENT_NAME in every container, and a different OTEL_SERVICE_NAME.`,
    );
  },
};

/**
 * The context stops being hosted by the whole application: the root of `main.ts` and of the worker
 * composes `hostedContexts`, the settings of its jobs leave the whole application, and a proof
 * composes both roots and checks that nothing is registered twice.
 */
function leaveTheWholeApplication(scope: Scope): void {
  const { ws, config } = scope;
  const rendered = vars(scope, {});

  applyWiring(
    ws,
    platformPath(scope, 'composition/compose-application.ts'),
    renderTemplate(`service/extracted.${wiringFamily(config)}.tpl`, rendered),
  );

  applyWiring(ws, platformPath(scope, 'jobs/job-settings.ts'), renderTemplate('service/extracted-name.tpl', rendered));

  const inert = inertPersistenceFile(config);

  // A project without HTTP on tsyringe composes nothing without a database until now: the proof needs the inert one.
  if (inert !== undefined && !ws.exists(inert[0])) {
    ws.create(inert[0], renderTemplate(inert[1], rendered));
  }

  if (!ws.exists(HOSTING_PROOF)) {
    ws.create(HOSTING_PROOF, renderTemplate(`architecture/hosting.${wiringFamily(config)}.spec.ts.tpl`, rendered));
  }

  applyWiring(ws, HOSTING_PROOF, renderTemplate('service/extracted-name.tpl', rendered));
}

function markDeployable(raw: Record<string, unknown>, context: string): void {
  const contexts = recordOf(raw['contexts']);

  raw['contexts'] = { ...contexts, [context]: { ...recordOf(contexts[context]), deployable: true } };
}
