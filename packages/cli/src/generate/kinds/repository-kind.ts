import type { Kind } from '../kind.js';
import { openScope } from '../open-scope.js';
import { existingAggregate } from './existing-aggregate.js';
import { generateRepository } from './generate-repository.js';

export const repositoryKind: Kind = {
  name: 'repository',
  aliases: [],
  usage: 'repository <context> <Aggregate> [--tenant-scoped]',
  summary:
    "A repository port (an abstract class of the domain), its in-memory fake, the adapter of the project's ORM with its mapper, the contract suite both pass, and its registration.",
  positionals: ['context', 'Aggregate'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);

    generateRepository(scope, existingAggregate(scope, request.args[1] ?? ''));
  },
};
