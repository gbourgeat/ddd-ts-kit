import type { Kind } from '../kind';
import { openScope } from '../open-scope';
import { existingAggregate } from './existing-aggregate';
import { generateRepository } from './generate-repository';
import { declarePersonalData } from './personal-data/declare-personal-data';

export const repositoryKind: Kind = {
  name: 'repository',
  aliases: [],
  usage:
    'repository <context> <Aggregate> [--tenant-scoped] [--personal <column>,<column>... [--subject <column>] [--erasure pseudonymise|row] [--retention <column>:<n><d|m|y>]]',
  summary:
    "A repository port (an abstract class of the domain), its in-memory fake, the adapter of the project's ORM with its mapper, the contract suite both pass, and its registration; with --personal, the declaration of the personal columns of its table, and the erasure and the export of the context that read it, and with --retention how long the rows keep it before the nightly purge erases them.",
  positionals: ['context', 'Aggregate'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);

    const aggregate = existingAggregate(scope, request.args[1] ?? '');
    const context = generateRepository(scope, aggregate);

    declarePersonalData(scope, aggregate, context);
  },
};
