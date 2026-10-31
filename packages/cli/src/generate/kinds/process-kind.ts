import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { wire } from '../wire';
import { specFamily } from './background/spec-family';
import { worldArrangement } from './world/world-arrangement';

export const processKind: Kind = {
  name: 'process',
  aliases: ['process-manager'],
  usage: 'process <context> <Name> [--term "<Term>=<meaning>"]...',
  summary:
    'A process manager: its state kept with optimistic concurrency, a first step that arms a deadline, a step that ends it in time, the step of the deadline, the background job that delivers its timeouts and the specs of both, given/when/then on the decisions.',
  positionals: ['context', 'Name'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'process', strip: ['process', 'saga'] });

    const spec = specVars(scope, { protected: false });
    const world = worldArrangement(scope, spec);

    const context = vars(scope, {
      name: named(name),
      spec,
      world: world.vars,
      process: {
        name: `${scope.context.kebab}.${name.kebab}`,
        timeoutJob: `${scope.context.kebab}.${name.kebab}-timeout`,
      },
    });

    emit(scope, context, [
      ['process/process.ts.tpl', `application/processes/${name.kebab}.process.ts`],
      ['process/timeout-job.ts.tpl', `application/background/${name.kebab}-timeout.background-job.ts`],
      ['process/process.spec.ts.tpl', `test/unit/${name.kebab}.process.spec.ts`],
      [
        `process/timeout-job.spec.${specFamily(scope)}.ts.tpl`,
        `test/unit/${name.kebab}-timeout.background-job.spec.ts`,
      ],
    ]);

    wire(scope, 'process/timeout-job', context);

    if (world.hint !== undefined) {
      scope.ws.note(world.hint);
    }
  },
};
