import { CliError } from '../../cli-error';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { markPolicyQuestions } from '../mark-policy-questions';
import { refinedByPolicy } from '../refined-by-policy';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { wire } from '../wire';
import { queryContext } from './query-context';
import { queryOutputs, type QueryVariant } from './query-outputs';

export const queryKind: Kind = {
  name: 'query',
  aliases: [],
  usage:
    'query <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--search] [--term "<Term>=<meaning>"]...',
  summary:
    'A query, its result, its handler, its read port with an in-memory adapter and a fake, its spec and its registration on the query bus; with --search, one page of a search filtered by the access scope of the actor.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'use case', strip: ['query', 'handler'] });
    const variant = queryVariant(scope);
    const { permission } = scope.flags;
    const asksPolicy = variant === '' && permission !== undefined && refinedByPolicy(scope, permission);
    const context = queryContext(scope, name, asksPolicy);

    emit(scope, context, queryOutputs(scope, name, variant));
    wire(scope, variant === '' ? 'query' : 'query/search', context);

    // A search is narrowed by the access scope of its actor: there is no element to ask a policy about, only a marker.
    if (variant !== '' && permission !== undefined) {
      markPolicyQuestions(scope, permission);
    }
  },
};

/** `--search`: the templates of a paginated search. A search is narrowed by what its actor may see, so it names a permission. */
function queryVariant(scope: Scope): QueryVariant {
  if (!scope.flags.search) {
    return '';
  }

  if (!scope.flags.public) {
    return 'search.';
  }

  throw new CliError(
    '--search cannot be combined with --public.',
    'A generated search is filtered by the access scope the authorizer computes for its actor: give it --permission <aggregate>.<action>, or generate a plain public query and page it yourself.',
  );
}
