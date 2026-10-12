import { specifierOf } from '../alias/index.js';
import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';

/** The class of each ORM of the kit that a repository adapter receives, and types its constructor parameter by. */
const PACKAGE_TOKENS: Readonly<Record<string, { readonly token: string; readonly from: string }>> = {
  knex: { token: 'KnexContext', from: '@ddd-ts-kit/knex' },
  typeorm: { token: 'TypeOrmContext', from: '@ddd-ts-kit/typeorm' },
};

/**
 * How a repository adapter reaches the storage: the token of the ORM package, or the `Database`
 * class the platform declares. The adapter types a constructor parameter by it, so it imports the
 * type; the module file of an explicit context, which lists it, imports the value.
 */
export function storageVars(config: Config): RenderContext {
  const provided = PACKAGE_TOKENS[config.stack.orm];
  const token = provided?.token ?? 'Database';

  const from = provided?.from ?? specifierOf(config, `${config.platformDir}/database/database.ts`);

  return {
    token,
    adapterImport: `import type { ${token} } from '${from}';`,
    moduleImport: `import { ${token} } from '${from}';`,
  };
}
