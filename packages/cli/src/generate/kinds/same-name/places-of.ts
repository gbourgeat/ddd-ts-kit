import type { Config } from '../../../config';
import { declaredModules } from '../../../model-modules';

const PERSISTENCE = 'infrastructure/persistence';

/** Every place the tables file of a context may stand at, in the order the kit reads them. */
export function placesOf(config: Config, context: string): string[] {
  const directory = `${config.contextsDir}/${context}`;
  const file = `${PERSISTENCE}/${context}.schema.ts`;

  return [
    ...declaredModules(config, context).map((module) => `${directory}/${module}/${file}`),
    `${directory}/shared/${file}`,
    `${directory}/${file}`,
  ];
}
