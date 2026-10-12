import type { RenderContext } from '../../templating/index.js';
import { assembledContext } from '../assembled-context.js';
import { contextVars } from '../context-vars.js';
import { relativeTo } from '../relative-to.js';
import type { ContextPlan } from './context-plan.js';

const GLOSSARY_TODO =
  'TODO(domain): define the ubiquitous language first: one row per term the domain experts use here, with the meaning it has in this context only. Every class, method and event is then named after these terms.';

const PURPOSE_TODO =
  'TODO(domain): say in two sentences which business capability this context owns and for whom; the first sentence is reused in the context map.';

/** What the templates of a context read: the stack, the context, how it is assembled and what its document opens with. */
export function planVars({ config, context, request }: ContextPlan): RenderContext {
  const terms = request.terms ?? [];
  const toContext = (from: string): string => `${relativeTo(from, config.contextsDir)}/${context.kebab}/`;

  return {
    ...contextVars(config, context),
    assembled: {
      module: assembledContext({ config, context }, toContext(config.platformDir)),
      proofModule: assembledContext({ config, context }, toContext('test/architecture')),
    },
    doc: {
      classification: config.contexts[context.kebab]?.classification ?? '',
      purpose: request.purpose?.trim() || PURPOSE_TODO,
      glossaryHint: terms.length > 0 ? '' : `\n${GLOSSARY_TODO}\n`,
      glossaryRows: terms.map((row) => `\n| ${row.term} | ${row.meaning} |  |`).join(''),
    },
  };
}
