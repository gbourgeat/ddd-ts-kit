import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import { requireContainer } from './background/require-container.js';

export const processKind: Kind = {
  name: 'process',
  aliases: ['process-manager'],
  usage: 'process <context> <Name> [--term "<Term>=<meaning>"]...',
  summary:
    'A process manager: its state kept with optimistic concurrency, a first step that arms a deadline, a step that ends it in time, the step of the deadline, the background job that delivers its timeouts and the specs of both, given/when/then on the decisions.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    requireContainer(scope, 'process manager');
    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'process', strip: ['process', 'saga'] });

    const context = vars(scope, {
      name: named(name),
      spec: specVars(scope, { protected: false }),
      process: {
        name: `${scope.context.kebab}.${name.kebab}`,
        timeoutJob: `${scope.context.kebab}.${name.kebab}-timeout`,
      },
    });

    emit(scope, context, [
      ['process/process.ts.tpl', `application/processes/${name.kebab}.process.ts`],
      ['process/timeout-job.ts.tpl', `application/background/${name.kebab}-timeout.background-job.ts`],
      ['process/process.spec.ts.tpl', `test/unit/${name.kebab}.process.spec.ts`],
      ['process/timeout-job.spec.ts.tpl', `test/unit/${name.kebab}-timeout.background-job.spec.ts`],
    ]);

    wire(scope, 'process/timeout-job', context);
  },
};
