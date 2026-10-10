import type { Name } from '../naming/index.js';
import type { RenderContext } from '../templating/index.js';

/** A name as the templates read it: `{{name.pascal}}`, `{{name.kebab}}`... */
export function named(name: Name): RenderContext {
  return { ...name };
}
