import type { ContextLocation } from '../project/location';
import type { ImportTarget } from '../project/resolve-import';
import { DECLARATIONS_ENTRY } from '../support/declarations/declaration-reader';
import { isDeclaredStyle } from '../support/declarations/is-declared-style';
import { defineRule } from '../support/rule/define-rule';
import { describeTarget } from '../support/imports/describe-target';
import { importListener } from '../support/imports/import-listener';
import { inLayer } from '../support/imports/in-layer';
import { OUTSIDE_CONCERN_MESSAGE } from '../support/outside-concerns/outside-concern-message';
import { outsideConcern } from '../support/outside-concerns/outside-concern';

type MessageId = 'package' | 'declarations' | 'outsideConcern' | 'builtin' | 'upstreamContract' | 'outerLayer';

export const layerDomainPurity = defineRule<MessageId>({
  id: 'layer/domain-purity',
  type: 'problem',
  recommended: 'error',
  description:
    'domain/ imports only its own domain/, the shared kernel and the allowed kernel packages: no framework, ORM, validation library or Node built-in.',
  messages: {
    outsideConcern: OUTSIDE_CONCERN_MESSAGE,
    package:
      'The domain imports the package "{{name}}". Remove the import: express the need as plain TypeScript or as a port (an abstract class) in application/ports, and keep decorators and schemas of "{{name}}" in infrastructure or presentation.',
    declarations: `The domain imports "${DECLARATIONS_ENTRY}": the domain declares nothing. Aggregates, entities, value objects, events, services and repository ports carry no decorator and no dependency list. Remove the import: put the decorator on the class of application/ or infrastructure/ that plays the role, and keep ports as abstract classes in domain/repositories and application/ports.`,
    builtin:
      'The domain imports the Node built-in "{{name}}". Receive the value (an id, a date, a hash) as a parameter, produced by a port such as IdGenerator or Clock in the application layer.',
    upstreamContract:
      'The domain of "{{here}}" imports the published language of "{{there}}". Translate the upstream contract in application/integration/handlers or infrastructure/anti-corruption and hand the domain its own types.',
    outerLayer:
      'The domain imports {{target}}. Invert the dependency: declare what the domain needs as a port, an abstract class of domain/repositories (or of application/ports), and let the outer layer implement it.',
  },
  create({ file, report }) {
    const here = inLayer(file, 'domain');

    if (here === undefined) {
      return {};
    }

    const allowed = file.config.domainAllowedPackages;
    const declares = isDeclaredStyle(file);

    return importListener(file, ({ node, target, specifier }) => {
      if (declares && specifier === DECLARATIONS_ENTRY) {
        report({ node, messageId: 'declarations' });
      } else if (target.kind === 'package') {
        const concern = outsideConcern(target.name);

        if (concern !== undefined) {
          report({ node, messageId: 'outsideConcern', data: { importer: 'The domain', specifier, ...concern } });
        } else if (!allowed.includes(target.name)) {
          report({ node, messageId: 'package', data: { name: target.name } });
        }
      } else if (target.kind === 'builtin') {
        report({ node, messageId: 'builtin', data: { name: specifier } });
      } else {
        const messageId = judgeFile(here, target);

        if (messageId !== undefined) {
          report({
            node,
            messageId,
            data: { here: here.context, there: contextOf(target), target: describeTarget(target) },
          });
        }
      }
    });
  },
});

function judgeFile(here: ContextLocation, target: Extract<ImportTarget, { kind: 'file' }>): MessageId | undefined {
  const there = target.location;

  if (there.area === 'shared-kernel') {
    return undefined;
  }

  if (there.area !== 'context') {
    return 'outerLayer';
  }

  if (there.context === here.context) {
    return there.layer === 'domain' ? undefined : 'outerLayer';
  }

  // The internals of another context are reported once, by context/published-language-only.
  return there.layer === 'published-language' ? 'upstreamContract' : undefined;
}

function contextOf(target: Extract<ImportTarget, { kind: 'file' }>): string {
  return target.location.area === 'context' ? target.location.context : '';
}
