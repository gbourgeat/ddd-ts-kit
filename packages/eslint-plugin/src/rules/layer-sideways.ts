import type { Layer } from '../project/layer';
import { defineRule } from '../support/rule/define-rule';
import { importListener } from '../support/imports/import-listener';
import { inLayer } from '../support/imports/in-layer';

interface Sideways {
  readonly id: string;
  readonly from: Layer;
  readonly to: Layer;
  readonly description: string;
  readonly instead: string;
}

export const layerPresentationNoInfrastructure = sidewaysRule({
  id: 'layer/presentation-no-infrastructure',
  from: 'presentation',
  to: 'infrastructure',
  description: 'presentation/ imports application/ (and domain types for mapping), never infrastructure/.',
  instead:
    'Send a command or a query through the bus of application/ instead; the adapter is bound to its port in {{context}}.module.ts.',
});

export const layerInfrastructureNoPresentation = sidewaysRule({
  id: 'layer/infrastructure-no-presentation',
  from: 'infrastructure',
  to: 'presentation',
  description: 'infrastructure/ implements ports of application/ and domain/, never imports presentation/.',
  instead:
    'Move the shared type to application/ (a port or a use case result) and let both sides import it from there.',
});

function sidewaysRule(rule: Sideways) {
  return defineRule<'forbidden'>({
    id: rule.id,
    type: 'problem',
    recommended: 'error',
    description: rule.description,
    messages: { forbidden: `${rule.from}/ imports ${rule.to}/ ({{path}}). ${rule.instead}` },
    create({ file, report }) {
      const here = inLayer(file, rule.from);

      if (here === undefined) {
        return {};
      }

      return importListener(file, ({ node, target }) => {
        if (target.kind !== 'file' || target.location.area !== 'context') {
          return;
        }

        if (target.location.layer !== rule.to || target.location.context !== here.context) {
          return;
        }

        report({ node, messageId: 'forbidden', data: { path: target.path, context: here.context } });
      });
    },
  });
}
