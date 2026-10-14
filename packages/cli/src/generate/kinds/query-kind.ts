import { CliError } from '../../cli-error.js';
import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { accessVars } from '../access-vars.js';
import { concept } from '../concept.js';
import { emit, type Output } from '../emit.js';
import { isDeclared } from '../is-declared.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { markPolicyQuestions } from '../mark-policy-questions.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { searchedElements } from '../searched-elements.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';

type Variant = '' | 'search.';

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
    const access = accessVars(scope, { name, kind: 'Query' });
    const variant = queryVariant(scope, access);
    const reader = { file: readerFile(scope, name) };

    const context = vars(scope, {
      name: named(name),
      access,
      spec: specVars(scope, access),
      search: { resource: searchedResource(access), ...searchedElements(name) },
      reader,
    });

    writeQuery(scope, { name, variant, reader: reader.file }, context);

    if (scope.flags.permission !== undefined) {
      markPolicyQuestions(scope, scope.flags.permission);
    }
  },
};

/**
 * The in-memory adapter of the read port. Declared, it is a role file bound by its own
 * decorator, so it carries the repository suffix.
 */
function readerFile(scope: Scope, name: Name): string {
  return isDeclared(scope.config) ? `in-memory-${name.kebab}-reader.repository` : `in-memory-${name.kebab}.reader`;
}

/** `--search`: the templates of a paginated search. A search is narrowed by what its actor may see, so it names a permission. */
function queryVariant(scope: Scope, access: RenderContext): Variant {
  if (!scope.flags.search) {
    return '';
  }

  if (access['protected'] === true) {
    return 'search.';
  }

  throw new CliError(
    '--search cannot be combined with --public.',
    'A generated search is filtered by the access scope the authorizer computes for its actor: give it --permission <aggregate>.<action>, or generate a plain public query and page it yourself.',
  );
}

/** The element a search answers, as the authorization model names it: the aggregate of its permission, to start with. */
function searchedResource(access: RenderContext): string {
  const permission = access['permission'];

  return typeof permission === 'string' ? (permission.split('.')[0] ?? '') : '';
}

interface QueryFiles {
  readonly name: Name;
  readonly variant: Variant;
  readonly reader: string;
}

function writeQuery(scope: Scope, { name, variant, reader }: QueryFiles, context: RenderContext): void {
  const folder = `application/queries/${name.kebab}`;

  emit(scope, context, [
    [`query/${variant}query.ts.tpl`, `${folder}/${name.kebab}.query.ts`],
    [`query/${variant}result.ts.tpl`, `${folder}/${name.kebab}.result.ts`],
    [`query/${variant}handler.ts.tpl`, `${folder}/${name.kebab}.handler.ts`],
    [`query/${variant}reader.port.ts.tpl`, `application/ports/${name.kebab}-reader.port.ts`],
    [`query/${variant}reader.in-memory.ts.tpl`, `infrastructure/persistence/${reader}.ts`],
    [`query/${variant}reader.fake.ts.tpl`, `test/fakes/${name.kebab}-reader.fake.ts`],
    [
      `query/${variant}handler.spec.${scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses'}.ts.tpl`,
      `test/unit/${name.kebab}.handler.spec.ts`,
    ],
    ...readerSpec(variant, reader),
  ]);

  wire(scope, variant === '' ? 'query' : 'query/search', context);
}

/** The canned reader of a search pages, sorts and filters by the access scope: an adapter, held by a spec of its own. */
function readerSpec(variant: Variant, reader: string): Output[] {
  return variant === '' ? [] : [['query/search.reader.spec.ts.tpl', `test/integration/${reader}.spec.ts`]];
}
