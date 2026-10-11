import { specifierOf } from '../alias/index.js';
import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { isDeclared } from './is-declared.js';

/** The class of each ORM of the kit that a repository adapter receives, and names in its dependency list. */
const PACKAGE_TOKENS: Readonly<Record<string, { readonly token: string; readonly from: string }>> = {
  knex: { token: 'KnexContext', from: '@ddd-ts-kit/knex' },
  typeorm: { token: 'TypeOrmContext', from: '@ddd-ts-kit/typeorm' },
};

/**
 * How a repository adapter reaches the storage: the token of the ORM package, or the `Database`
 * class the platform declares. A declared adapter names it in its dependency list, so it imports
 * the value; an adapter bound in a module file only needs the type.
 */
export function storageVars(config: Config): RenderContext {
  const provided = PACKAGE_TOKENS[config.stack.orm];
  const token = provided?.token ?? 'Database';

  const from = provided?.from ?? specifierOf(config, `${config.platformDir}/database/database.ts`);
  const named = isDeclared(config) ? token : `type ${token}`;

  return {
    token,
    adapterImport: `import ${isDeclared(config) ? '' : 'type '}{ ${token} } from '${from}';`,
    moduleImport: `import { ${token} } from '${from}';`,
    knexImport: named,
    typeormImport: named,
  };
}
