import { defineRule } from '../support/define-rule.js';
import { describeTarget, importListener, inContext, inLayer } from '../support/imports.js';

export const contextPublishedLanguageOnly = defineRule<'internals'>({
  id: 'context/published-language-only',
  type: 'problem',
  recommended: 'error',
  description: "A file imports from another context only through that context's published-language/.",
  messages: {
    internals:
      '"{{here}}" imports the internals of "{{there}}" ({{path}}). Import from {{contextsDir}}/{{there}}/published-language only; if the type is missing there, publish it with `ddd-ts-kit generate integration-event {{there}} <Aggregate> <Fact>` or react to an integration event.',
  },
  create({ file, report }) {
    const here = inContext(file);
    if (here === undefined) return {};
    return importListener(file, ({ node, target }) => {
      if (target.kind !== 'file' || target.location.area !== 'context') return;
      const there = target.location;
      if (there.context === here.context || there.layer === 'published-language') return;
      report({ node, messageId: 'internals', data: { here: here.context, there: there.context, path: target.path, contextsDir: file.config.contextsDir } });
    });
  },
});

export const contextDeclaredRelationship = defineRule<'undeclared'>({
  id: 'context/declared-relationship',
  type: 'problem',
  recommended: 'error',
  description: 'Importing the published language of another context requires the relationship to be declared in the config.',
  messages: {
    undeclared:
      '"{{here}}" depends on "{{there}}" but the relationship is not declared. Add { "context": "{{there}}", "relationship": "published-language" } to contexts.{{here}}.upstreams in ddd-ts-kit.config.json, after checking that the dependency direction is intended.',
  },
  create({ file, report }) {
    const here = inContext(file);
    if (here === undefined) return {};
    const upstreams = file.config.contexts[here.context]?.upstreams.map((upstream) => upstream.context) ?? [];
    return importListener(file, ({ node, target }) => {
      if (target.kind !== 'file' || target.location.area !== 'context') return;
      const there = target.location;
      if (there.context === here.context || there.layer !== 'published-language' || upstreams.includes(there.context)) return;
      report({ node, messageId: 'undeclared', data: { here: here.context, there: there.context } });
    });
  },
});

export const contextPublishedLanguageIsAContract = defineRule<'leak'>({
  id: 'context/published-language-is-a-contract',
  type: 'problem',
  recommended: 'error',
  description: 'published-language/ imports only the kernel, the event declaration helper with the schema library of the project, and other published languages.',
  messages: {
    leak: 'The published language imports {{target}}. Declare the contract with plain serializable types written in this folder: copy the few fields other contexts need instead of exposing an internal model.',
  },
  create({ file, report }) {
    if (inLayer(file, 'published-language') === undefined) return {};
    const allowed = file.config.publishedLanguageAllowedPackages;
    return importListener(file, ({ node, target }) => {
      if (target.kind === 'package' && allowed.includes(target.name)) return;
      if (target.kind === 'file' && target.location.area === 'context' && target.location.layer === 'published-language') return;
      report({ node, messageId: 'leak', data: { target: describeTarget(target) } });
    });
  },
});
