import type { ContextLocation, ImportTarget, Layer } from '../project/classify.js';
import { defineRule } from '../support/define-rule.js';
import { describeTarget, importListener, inLayer } from '../support/imports.js';

const INWARD: readonly Layer[] = ['domain', 'application', 'published-language'];

export const layerApplicationInward = defineRule<'package' | 'builtin' | 'outward'>({
  id: 'layer/application-inward',
  type: 'problem',
  recommended: 'error',
  description:
    'application/ imports domain/, application/, published languages and the allowed kernel packages: never infrastructure/, presentation/, a framework or a driver.',
  messages: {
    package:
      'The application layer imports the package "{{name}}". Declare a port in application/ports named after the need, implement it with "{{name}}" in infrastructure/, and bind it in {{context}}.module.ts.',
    builtin:
      'The application layer imports the Node built-in "{{name}}". Hide the I/O behind a port in application/ports and implement it in infrastructure/external.',
    outward:
      'The application layer imports {{target}}. Depend on a port (application/ports) or a repository interface (domain/repositories) instead, and let the module file bind the adapter.',
  },
  create({ file, report }) {
    const here = inLayer(file, 'application');
    if (here === undefined) return {};
    const allowed = file.config.applicationAllowedPackages;
    return importListener(file, ({ node, target, specifier }) => {
      if (target.kind === 'package') {
        if (!allowed.includes(target.name)) report({ node, messageId: 'package', data: { name: target.name, context: here.context } });
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
  if (there.area === 'shared-kernel') return false;
  if (there.area !== 'context') return true;
  // Another context: the context/* rules decide.
  return there.context === here.context && !INWARD.includes(there.layer);
}
