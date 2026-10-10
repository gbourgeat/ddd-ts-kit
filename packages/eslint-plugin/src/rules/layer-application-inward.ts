import type { ContextLocation } from '../project/location.js';
import type { ImportTarget } from '../project/resolve-import.js';
import type { Layer } from '../project/layer.js';
import { DECLARATIONS_ENTRY } from '../support/declarations/declaration-reader.js';
import { isDeclaredStyle } from '../support/declarations/is-declared-style.js';
import { defineRule } from '../support/rule/define-rule.js';
import { describeTarget } from '../support/imports/describe-target.js';
import { importListener } from '../support/imports/import-listener.js';
import { inLayer } from '../support/imports/in-layer.js';
import { OUTSIDE_CONCERN_MESSAGE } from '../support/outside-concerns/outside-concern-message.js';
import { outsideConcern } from '../support/outside-concerns/outside-concern.js';

const INWARD: readonly Layer[] = ['domain', 'application', 'published-language'];

export const layerApplicationInward = defineRule<'package' | 'outsideConcern' | 'builtin' | 'outward'>({
  id: 'layer/application-inward',
  type: 'problem',
  recommended: 'error',
  description:
    'application/ imports domain/, application/, published languages and the allowed kernel packages: never infrastructure/, presentation/, a framework or a driver.',
  messages: {
    outsideConcern: OUTSIDE_CONCERN_MESSAGE,
    package:
      'The application layer imports the package "{{name}}". Declare a port (an abstract class) in application/ports named after the need, implement it with "{{name}}" in infrastructure/, and bind it in {{context}}.module.ts (in the declared style, declare the adapter with `@Adapter`).',
    builtin:
      'The application layer imports the Node built-in "{{name}}". Hide the I/O behind a port in application/ports and implement it in infrastructure/external.',
    outward:
      'The application layer imports {{target}}. Depend on a port, the abstract class of application/ports or of domain/repositories, instead, and let the module file, or the declaration of the adapter, bind it.',
  },
  create({ file, report }) {
    const here = inLayer(file, 'application');

    if (here === undefined) {
      return {};
    }

    const allowed = file.config.applicationAllowedPackages;
    const declares = isDeclaredStyle(file);

    return importListener(file, ({ node, target, specifier }) => {
      // Declarations are pure metadata: a declared use case imports them whatever the allow-list says.
      if (declares && specifier === DECLARATIONS_ENTRY) {
        return;
      }

      if (target.kind === 'package') {
        const concern = outsideConcern(target.name);

        if (concern !== undefined) {
          report({
            node,
            messageId: 'outsideConcern',
            data: { importer: 'The application layer', specifier, ...concern },
          });
        } else if (!allowed.includes(target.name)) {
          report({ node, messageId: 'package', data: { name: target.name, context: here.context } });
        }
      } else if (target.kind === 'builtin') {
        report({ node, messageId: 'builtin', data: { name: specifier } });
      } else if (pointsOutward(here, target)) {
        report({ node, messageId: 'outward', data: { target: describeTarget(target) } });
      }
    });
  },
});

function pointsOutward(here: ContextLocation, target: Extract<ImportTarget, { kind: 'file' }>): boolean {
  const there = target.location;

  if (there.area === 'shared-kernel') {
    return false;
  }

  if (there.area !== 'context') {
    return true;
  }

  // Another context: the context/* rules decide.
  return there.context === here.context && !INWARD.includes(there.layer);
}
