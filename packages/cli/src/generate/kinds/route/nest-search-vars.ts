import type { RenderContext } from '../../../templating';
import type { Name } from '../../../naming';
import { searchedElements } from '../../searched-elements';
import type { ControllerPlan } from './controller-plan';

/** What the template of a Nest controller of a search reads: the imports of a page and the name of one line. */
export function nestSearchVars(name: Name, { endpoint, group, cache }: ControllerPlan): RenderContext {
  const method = `${endpoint.method.charAt(0)}${endpoint.method.slice(1).toLowerCase()}`;

  return {
    ...searchedElements(name),
    nestImports: ['Controller', method, 'Inject', 'Query'].sort().join(', '),
    kitImports: [
      ...(cache === undefined ? [] : ['CacheScope']),
      'pageQuerySchema',
      'pageResponse',
      'pageSchemaOf',
      ...(group === undefined ? ['Public'] : []),
      'type PageBody',
    ].join(', '),
  };
}
