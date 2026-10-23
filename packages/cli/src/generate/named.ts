import type { Name } from '../naming';
import type { RenderContext } from '../templating';

/** A name as the templates read it: `{{name.pascal}}`, `{{name.kebab}}`... */
export function named(name: Name): RenderContext {
  return { ...name };
}
