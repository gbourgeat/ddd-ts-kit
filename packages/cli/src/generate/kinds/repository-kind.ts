import type { Kind } from '../kind';
import { openScope } from '../open-scope';
import { existingAggregate } from './existing-aggregate';
import { generateRepository } from './generate-repository';

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
