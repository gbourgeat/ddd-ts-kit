import type { ContextLocation, ImportTarget } from '../project/classify.js';
import { defineRule } from '../support/define-rule.js';
import { describeTarget, importListener, inLayer } from '../support/imports.js';
import { OUTSIDE_CONCERN_MESSAGE, outsideConcern } from '../support/outside-concerns.js';

type MessageId = 'package' | 'outsideConcern' | 'builtin' | 'upstreamContract' | 'outerLayer';

export const layerDomainPurity = defineRule<MessageId>({
  id: 'layer/domain-purity',
  type: 'problem',
  recommended: 'error',
  description: 'domain/ imports only its own domain/, the shared kernel and the allowed kernel packages: no framework, ORM, validation library or Node built-in.',
  messages: {
    outsideConcern: OUTSIDE_CONCERN_MESSAGE,
    package:
      'The domain imports the package "{{name}}". Remove the import: express the need as plain TypeScript or as a port in application/ports, and keep decorators and schemas of "{{name}}" in infrastructure or presentation.',
    builtin:
      'The domain imports the Node built-in "{{name}}". Receive the value (an id, a date, a hash) as a parameter, produced by a port such as IdGenerator or Clock in the application layer.',
    upstreamContract:
      'The domain of "{{here}}" imports the published language of "{{there}}". Translate the upstream contract in application/integration/consumers or infrastructure/anti-corruption and hand the domain its own types.',
    outerLayer:
      'The domain imports {{target}}. Invert the dependency: declare what the domain needs as an interface in domain/ (or a port in application/ports) and let the outer layer implement it.',
  },
  create({ file, report }) {
    const here = inLayer(file, 'domain');
    if (here === undefined) return {};
    const allowed = file.config.domainAllowedPackages;
    return importListener(file, ({ node, target, specifier }) => {
      if (target.kind === 'package') {
        const concern = outsideConcern(target.name);
        if (concern !== undefined) report({ node, messageId: 'outsideConcern', data: { importer: 'The domain', specifier, ...concern } });
        else if (!allowed.includes(target.name)) report({ node, messageId: 'package', data: { name: target.name } });
      } else if (target.kind === 'builtin') {
        report({ node, messageId: 'builtin', data: { name: specifier } });
      } else {
        const messageId = judgeFile(here, target);
        if (messageId !== undefined) report({ node, messageId, data: { here: here.context, there: contextOf(target), target: describeTarget(target) } });
      }
    });
  },
});

function judgeFile(here: ContextLocation, target: Extract<ImportTarget, { kind: 'file' }>): MessageId | undefined {
  const there = target.location;
  if (there.area === 'shared-kernel') return undefined;
  if (there.area !== 'context') return 'outerLayer';
  if (there.context === here.context) return there.layer === 'domain' ? undefined : 'outerLayer';
  // The internals of another context are reported once, by context/published-language-only.
  return there.layer === 'published-language' ? 'upstreamContract' : undefined;
}

function contextOf(target: Extract<ImportTarget, { kind: 'file' }>): string {
  return target.location.area === 'context' ? target.location.context : '';
}
