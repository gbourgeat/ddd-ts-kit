import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { renderTemplate } from '../../templating';
import { applyWiring } from '../apply-wiring';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { wire } from '../wire';
import { jobVars } from './job/job-vars';
import { readSentCommand } from './job/read-sent-command';
import { requestedSchedule } from './job/requested-schedule';
import { writtenSchedule } from './job/written-schedule';
import { platformPath } from '../platform-path';

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
