import { CliError } from '../../cli-error.js';
import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { markPolicyQuestions } from '../mark-policy-questions.js';
import { refinedByPolicy } from '../refined-by-policy.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { wire } from '../wire.js';
import { queryContext } from './query-context.js';
import { queryOutputs, type QueryVariant } from './query-outputs.js';

export const queryKind: Kind = {
  name: 'query',
  aliases: [],
  usage:
    'query <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--search] [--term "<Term>=<meaning>"]...',
  summary:
    'A query, its result, its handler, its read port with an in-memory adapter and a fake, its spec and its registration on the query bus; with --search, one page of a search filtered by the access scope of the actor.',
  positionals: ['context', 'UseCaseName'],
  writesShared: false,
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
