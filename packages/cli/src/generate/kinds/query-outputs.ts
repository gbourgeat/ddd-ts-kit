import type { Name } from '../../naming';
import type { Output } from '../emit';
import type { Scope } from '../scope';
import { readerFile } from './reader-file';

/** `search.` for a paginated search narrowed by the access scope of its actor, nothing for a plain query. */
export type QueryVariant = '' | 'search.';

/** The files of a query, relative to its context. */
export function queryOutputs(scope: Scope, name: Name, variant: QueryVariant): Output[] {
  const folder = `application/queries/${name.kebab}`;
  const reader = readerFile(scope, name);

  return [
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
    ...(variant === '' ? [] : [['query/search.reader.spec.ts.tpl', `test/integration/${reader}.spec.ts`] as const]),
  ];
}
