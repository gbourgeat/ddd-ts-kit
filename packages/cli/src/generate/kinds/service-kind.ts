import { CONFIG_FILE } from '../../config/index.js';
import { renderTemplate } from '../../templating/index.js';
import type { Kind } from '../kind.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';
import { addComposeService } from './extraction/add-compose-service.js';
import { editJson } from './extraction/edit-json.js';
import { EntryPoint } from './extraction/entry-point.js';
import { recordOf } from './extraction/record-of.js';
import { serviceSelection } from './extraction/service-selection.js';

export const serviceKind: Kind = {
  name: 'service',
  aliases: [],
  usage: 'service <context>',
  summary:
    'The context run alone, with its scheduled jobs: its entry point under apps/, a start script, a compose service, and `deployable` in the config.',
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

    ws.note(
      `Build the image of the service with \`docker build --build-arg ENTRY=${entry.compiled} .\`, or start it with \`docker compose --profile services up ${context.kebab}\`.`,
    );

    ws.note(
      `The service takes the scheduled jobs of ${context.kebab} with it: it runs them unless RUN_JOBS=false, and no job of another context.`,
    );
  },
};

function markDeployable(raw: Record<string, unknown>, context: string): void {
  const contexts = recordOf(raw['contexts']);

  raw['contexts'] = { ...contexts, [context]: { ...recordOf(contexts[context]), deployable: true } };
}
