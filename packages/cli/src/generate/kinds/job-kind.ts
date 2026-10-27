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
import { jobVars, type JobTenancy } from './job/job-vars';
import { readSentCommand } from './job/read-sent-command';
import { requestedSchedule } from './job/requested-schedule';
import { writtenSchedule } from './job/written-schedule';
import { platformPath } from '../platform-path';

export const jobKind: Kind = {
  name: 'job',
  aliases: [],
  usage:
    'job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName> [--global] [--term "<Term>=<meaning>"]...',
  summary:
    'A job run by time (once per tenant under tenancy, or `--global`) that sends one command as its own system actor, its spec, its registration, its switch in the job settings of the platform and, where the authorization model makes it one line, the grant of that actor.',
  positionals: ['context', 'Name'],
  writesShared: true,
  writesInModules: true,
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
      job: jobVars(scope, { name, schedule, command, tenancy: tenancyOf(scope, name) }),
    });

    writeJob(scope, name, context);
  },
};

/**
 * Under tenancy a job runs once per tenant unless `--global` says it works across them: a global job
 * runs in no tenant, and a tenant-scoped repository refuses to be read there.
 */
function tenancyOf(scope: Scope, name: Name): JobTenancy {
  const { global } = scope.flags;

  if (scope.config.stack.tenancy === 'none') {
    if (global) {
      throw new CliError(
        '--global means nothing in a project without tenancy.',
        `Every job runs once there: drop --global from \`generate job ${scope.context.kebab} ${name.pascal}\`.`,
      );
    }

    return undefined;
  }

  scope.ws.note(
    global
      ? `${name.pascal}Job is global (\`tenancy: 'global'\`): it runs once per occurrence, in no tenant, so a tenant-scoped repository refuses it. Drop --global for a job that works one tenant at a time.`
      : `${name.pascal}Job runs per tenant (\`tenancy: 'per-tenant'\`): once per tenant of the TenantDirectory for each occurrence (the organisations of the identity context when the project has it, else the list of TENANTS, read once at the boot), each run in the scope of its tenant. Pass --global for work across tenants.`,
  );

  return global ? 'global' : 'per-tenant';
}

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
