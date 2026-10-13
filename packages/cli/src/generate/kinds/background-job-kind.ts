import { CliError } from '../../cli-error.js';
import type { Name } from '../../naming/index.js';
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
import { backgroundJobVars } from './background/background-job-vars.js';
import { requireContainer } from './background/require-container.js';
import { readSentCommand } from './job/read-sent-command.js';

/** `CompileReportBackgroundJob` and `compile-report-background-job` name the job `CompileReport`. */
const ROLE_SUFFIX = /(?<=[a-z0-9])[-_]?background[-_]?job$/i;

export const backgroundJobKind: Kind = {
  name: 'background-job',
  aliases: [],
  usage: 'background-job <context> <Name> --command <UseCaseName> [--term "<Term>=<meaning>"]...',
  summary:
    'A job a use case enqueues, run later by a worker as the actor that enqueued it, with retries and a lease: the class named by its static jobName, its spec through the queue of the test application and its registration.',
  positionals: ['context', 'Name'],
  writesShared: false,
  textFlags: ['command'],
  run: (request) => {
    const scope = openScope(request);

    requireContainer(scope, 'background job');
    learnTerms(scope);

    const input = (request.args[1] ?? '').replace(ROLE_SUFFIX, '');
    const name = concept(scope, input, { what: 'background job', strip: ['job'] });
    const command = readSentCommand(scope, commandNamed(scope, name), 'background job');

    const context = vars(scope, {
      name: named(name),
      spec: specVars(scope, { protected: false }),
      job: backgroundJobVars(scope, name, command),
    });

    emit(scope, context, [
      ['background-job/background-job.ts.tpl', `application/background/${name.kebab}.background-job.ts`],
      ['background-job/background-job.spec.ts.tpl', `test/unit/${name.kebab}.background-job.spec.ts`],
    ]);

    wire(scope, 'background-job', context);
  },
};

function commandNamed(scope: Scope, name: Name): string {
  const { commandName } = scope.flags;

  if (commandName !== undefined && commandName.trim() !== '') {
    return commandName;
  }

  throw new CliError(
    'A background job needs --command.',
    `A background job, like a scheduled one, only triggers use cases: pass the command it sends, for example \`ddd-ts-kit generate background-job ${scope.context.kebab} ${name.pascal} --command <UseCaseName>\`.`,
  );
}
