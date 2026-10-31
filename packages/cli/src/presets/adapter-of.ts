import type { Config } from '../config';
import type { RenderContext } from '../templating';

/** The prefix of the adapters the persistence of the project names its classes and files by: `Prisma`, `prisma`. */
export function adapterOf(config: Config): RenderContext {
  const { orm } = config.stack;

  return { pascal: `${orm.charAt(0).toUpperCase()}${orm.slice(1)}`, kebab: orm };
}
