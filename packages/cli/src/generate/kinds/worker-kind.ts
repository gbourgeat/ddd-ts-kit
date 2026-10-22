import { CONFIG_FILE, type Config } from '../../config';
import { CliError } from '../../cli-error';
import { replaceRegion } from '../../markers';
import { stackVars } from '../../stack/stack-vars';
import { renderTemplate } from '../../templating';
import type { Workspace } from '../../workspace';
import type { Kind } from '../kind';
import { addComposeService } from './extraction/add-compose-service';
import { editJson } from './extraction/edit-json';
import { EntryPoint } from './extraction/entry-point';

const NAME = 'worker';

export const workerKind: Kind = {
  name: NAME,
  aliases: [],
  usage: NAME,
  summary:
    'The scheduled jobs in a process of their own: apps/worker/main.ts (the modules of main.ts, no HTTP server), a start script, a compose service, `worker` in the config, and the API started with its jobs off.',
  positionals: [],
  writesShared: true,
  run: ({ ws, config }) => {
    if (config.contexts[NAME] !== undefined) {
      throw takenByAContext();
    }

    const entry = new EntryPoint(config, NAME);

    const context = stackVars(config);

    ws.create(entry.source, renderTemplate('worker/main.ts.tpl', context));
    entry.declareIn(ws);

    editJson(ws, CONFIG_FILE, (raw) => {
      raw['worker'] = true;
    });

    addComposeService(ws, NAME, renderTemplate('worker/compose.tpl', context));
    leaveTheJobsToTheWorker(ws, config);

    ws.note(
      `Start the worker with \`npm run start:${NAME}\` after a build, or with \`docker compose --profile services up ${NAME}\`. The API now starts with its jobs off: RUN_JOBS=true turns them back on in a process.`,
    );

    ws.note(severalInstances(config));
  },
};

function takenByAContext(): CliError {
  return new CliError(
    `apps/${NAME}/main.ts is the entry point of the context "${NAME}".`,
    'A context named worker and the worker process would share one entry point: rename the context, then run `ddd-ts-kit generate worker` again.',
  );
}

/** `RUN_JOBS` left unset now means no: the process that serves requests stops running the jobs the worker runs. */
function leaveTheJobsToTheWorker(ws: Workspace, config: Config): void {
  const file = `${config.platformDir}/config/load-config.ts`;
  const flipped = replaceRegion(ws.read(file) ?? '', 'run-jobs', ['const runJobsByDefault = false;']);

  if (flipped === undefined) {
    ws.note(
      `${file} has no "ddd-ts-kit:run-jobs" region: make RUN_JOBS default to false by hand, or the API and the worker both run every job.`,
    );
  } else {
    ws.update(file, flipped);
  }
}

function severalInstances(config: Config): string {
  if (config.stack.cache === 'redis') {
    return 'Several workers may run: the Redis lock of the platform keeps an occurrence of a job to one of them, best effort, so a job stays idempotent.';
  }

  return 'Run ONE worker: without `--cache redis` the lock is in the memory of each process, so two workers would both run every job. Bind a lock between processes to the kernel `Lock` before scaling out.';
}
