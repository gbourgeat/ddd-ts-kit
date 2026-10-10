import { CliError } from '../../cli-error.js';
import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { accessVars } from '../access-vars.js';
import { concept } from '../concept.js';
import { emit } from '../emit.js';
import { isDeclared } from '../is-declared.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';

type Variant = '' | 'list.';

export const queryKind: Kind = {
  name: 'query',
  aliases: [],
  usage:
    'query <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--list] [--term "<Term>=<meaning>"]...',
  summary:
    'A query, its result, its handler, its read port with an in-memory adapter and a fake, its spec and its registration on the query bus; with --list, one page of a list filtered by the access scope of the actor.',
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
      list: { resource: listedResource(access) },
      reader,
    });

    writeQuery(scope, { name, variant, reader: reader.file }, context);
  },
};

/**
 * The in-memory adapter of the read port. Declared, it is a role file bound by its own
 * decorator, so it carries the repository suffix.
 */
function readerFile(scope: Scope, name: Name): string {
  return isDeclared(scope.config) ? `in-memory-${name.kebab}-reader.repository` : `in-memory-${name.kebab}.reader`;
}

/** `--list`: the templates of a paginated list. A list is narrowed by what its actor may see, so it names a permission. */
function queryVariant(scope: Scope, access: RenderContext): Variant {
  if (!scope.flags.list) {
    return '';
  }

  if (access['protected'] === true) {
    return 'list.';
  }

  throw new CliError(
    '--list cannot be combined with --public.',
    'A generated list is filtered by the access scope the authorizer computes for its actor: give it --permission <aggregate>.<action>, or generate a plain public query and page it yourself.',
  );
}

/** The element a list shows, as the authorization model names it: the aggregate of its permission, to start with. */
function listedResource(access: RenderContext): string {
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
  ]);

  wire(scope, variant === '' ? 'query' : 'query/list', context);
}
