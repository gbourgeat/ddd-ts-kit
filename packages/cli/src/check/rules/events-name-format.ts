import { domainEventNames } from '../events/domain-event-names.js';
import { eventDeclarations } from '../events/event-declarations.js';
import { inDeclaration } from '../events/in-declaration.js';
import { isTypeLiteral } from '../events/is-type-literal.js';
import type { ContextLocation } from '../model/context-location.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { KEBAB_SEGMENT } from '../support/kebab-segment.js';
import { perFile } from '../support/per-file.js';

interface Named {
  readonly line: number;
  readonly value: string;
}

export const eventsNameFormat: Rule = {
  id: 'events/name-format',
  description: 'Domain and integration event names follow <context>.<aggregate>.<fact-in-past-tense>, in kebab-case.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!inContext(file.location) || file.isTest) return [];

      const { context } = file.location;

      return eventNames(file, file.location)
        .filter(({ value }) => !isEventName(value, context))
        .map(({ line, value }) => ({
          line,
          message: `The event name "${value}" does not follow <context>.<aggregate>.<fact>.`,
          fix: `Name it "${context}.<aggregate>.<fact-in-past-tense>" in kebab-case, for example "${context}.invoice.issued".`,
        }));
    });
  },
};

function eventNames(file: SourceFile, { layer, inside }: ContextLocation): Named[] {
  if (layer === 'domain' && inside[0] === 'events') return domainEventNames(file);

  return layer === 'published-language' ? integrationEventNames(file) : [];
}

function integrationEventNames(file: SourceFile): Named[] {
  const declarations = eventDeclarations(file);
  const declared = declarations.flatMap(({ type }) => (type === undefined ? [] : [type]));
  // Outside a declaration, `type: 'x'` may be a plain discriminator: only dotted values are event names.
  const handwritten = file.scan.strings.filter((literal) => literal.value.includes('.') && !inDeclaration(declarations, literal.start) && isTypeLiteral(file, literal.start));

  return [...declared, ...handwritten];
}

function isEventName(value: string, context: string): boolean {
  const parts = value.split('.');

  return parts.length === 3 && parts[0] === context && parts.every((part) => KEBAB_SEGMENT.test(part));
}
