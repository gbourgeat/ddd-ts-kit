import { CliError } from '../../cli-error.js';
import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { renderTemplate } from '../../templating/index.js';
import { applyWiring } from '../apply-wiring.js';
import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import { jobVars } from './job/job-vars.js';
import { readSentCommand } from './job/read-sent-command.js';
import { requestedSchedule } from './job/requested-schedule.js';
import { writtenSchedule } from './job/written-schedule.js';
import { platformPath } from '../platform-path.js';

export const jobKind: Kind = {
  name: 'job',
  aliases: [],
  usage:
    'job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName> [--term "<Term>=<meaning>"]...',
  summary:
    'A job run by time that sends one command as its own system actor, its spec, its registration, its switch in the job settings of the platform and, where the authorization model makes it one line, the grant of that actor.',
  positionals: ['context', 'Name'],
  writesShared: true,
  textFlags: ['command'],
  run: (request) => {
    const scope = openScope(request);
    const schedule = writtenSchedule(requestedSchedule(request.flags));

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'job', strip: ['job'] });
    const command = readSentCommand(scope, commandNamed(scope, name));

    const context = vars(scope, {
      name: named(name),
      spec: specVars(scope, { protected: false }),
      job: jobVars(scope, { name, schedule, command }),
    });

    writeJob(scope, name, context);
  },
};

function commandNamed(scope: Scope, name: Name): string {
  const { commandName } = scope.flags;

  if (commandName !== undefined && commandName.trim() !== '') {
    return commandName;
  }

  throw new CliError(
    'A job needs --command.',
    `A job only triggers a use case: pass the command it sends, for example \`ddd-ts-kit generate job ${scope.context.kebab} ${name.pascal} --every 15m --command <UseCaseName>\`.`,
  );
}

function writeJob(scope: Scope, name: Name, context: RenderContext): void {
  emit(scope, context, [
    ['job/job.ts.tpl', `application/scheduling/${name.kebab}.job.ts`],
    [
      `job/job.spec.${scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses'}.ts.tpl`,
      `test/unit/${name.kebab}.job.spec.ts`,
    ],
  ]);

  wire(scope, 'job', context);
  applyWiring(scope.ws, platformPath(scope, 'jobs/job-settings.ts'), renderTemplate('job/settings.tpl', context));
}
