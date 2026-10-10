import type { Name } from '../../naming/index.js';
import { concept } from '../concept.js';
import { requireFile } from '../require-file.js';
import type { Scope } from '../scope.js';

/** The name of an aggregate other kinds build on: it has to exist, its vocabulary was judged when it was created. */
export function existingAggregate(scope: Scope, input: string): Name {
  const aggregate = concept({ ...scope, flags: { ...scope.flags, allowName: true } }, input, {
    what: 'aggregate',
    strip: ['repository', 'builder'],
  });

  requireFile(scope, {
    file: `domain/aggregates/${aggregate.kebab}.aggregate.ts`,
    what: `The aggregate ${aggregate.pascal}`,
    createdBy: `ddd-ts-kit generate aggregate ${scope.context.kebab} ${aggregate.pascal}`,
  });

  return aggregate;
}
