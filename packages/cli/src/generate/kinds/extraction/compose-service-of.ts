import type { Config } from '../../../config';
import type { Name } from '../../../naming';
import { renderTemplate } from '../../../templating';
import { contextVars } from '../../context-vars';

/** The service of the compose file that runs a context alone. */
export function composeServiceOf(config: Config, context: Name): string {
  const service = { portVariable: `\${${context.constant}_PORT:-3001}` };

  return renderTemplate('service/compose.tpl', { ...contextVars(config, context), service });
}
