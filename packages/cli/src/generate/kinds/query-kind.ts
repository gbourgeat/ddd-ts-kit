import { CliError } from '../../cli-error';
import { parseConceptName } from '../../naming';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { markPolicyQuestions } from '../mark-policy-questions';
import { refinedByPolicy } from '../refined-by-policy';
import { permissionWords } from '../permission-words';
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
    'A query, its result, its handler, its read port with an in-memory adapter and a fake, its spec and its registration on the query bus; with --search, one page of a search filtered by the access scope of the actor; a name that starts with List is refused, a read that takes criteria is a Search<Things>.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const input = request.args[1] ?? '';

    refuseListQuery(input);

    const name = concept(scope, input, {
      what: 'use case',
      strip: ['query', 'handler'],
      alongside: permissionWords(scope.flags.permission),
    });

    const variant = queryVariant(scope);
    const { permission } = scope.flags;
    const asksPolicy = variant === '' && permission !== undefined && refinedByPolicy(scope, permission);
    const { vars: context, worldHint } = queryContext(scope, name, { asksPolicy, search: variant !== '' });

    emit(scope, context, queryOutputs(scope, name, variant));

    if (worldHint !== undefined) {
      scope.ws.note(worldHint);
    }

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

/**
 * A read that takes criteria, a scope or a page is a search, never a list (rule naming/search-not-list):
 * the checker refuses `ListInvoices` whatever the glossary says, so the generator refuses it first,
 * before a glossary refusal sends the user to a term that would lead to the same files.
 */
function refuseListQuery(input: string): void {
  const name = parseConceptName(input, 'use case', { strip: ['query', 'handler'], allowReserved: true });
  const [first, ...rest] = name.words.split(' ');

  if (first !== 'list') {
    return;
  }

  const search = ['search', ...rest].map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');

  throw new CliError(
    `"${name.pascal}" names a query List...: a read that takes criteria, a scope or a page is a search (rule naming/search-not-list).`,
    `Name it ${search}: \`ddd-ts-kit generate query <context> ${search} --search --permission <aggregate>.<action> --term "Search=<what it means for the business>"\` (leave --term out when the glossary holds Search already).`,
  );
}
