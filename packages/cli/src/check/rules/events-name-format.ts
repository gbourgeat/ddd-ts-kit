import { domainEventNames } from '../domain-event-names.js';
import { eventDeclarations, inDeclaration, isTypeLiteral } from '../event-declarations.js';
import type { Rule, SourceFile } from '../types.js';
import { inContext, KEBAB_SEGMENT, reporter, type ContextLocation } from './helpers.js';

export const eventsNameFormat: Rule = {
  id: 'events/name-format',
  description: 'Domain and integration event names follow <context>.<aggregate>.<fact-in-past-tense>, in kebab-case.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => {
      if (!inContext(file.location) || file.isTest) return [];
      const { context } = file.location;
      return eventNames(file, file.location)
        .filter(({ value }) => !isEventName(value, context))
        .map(({ line, value }) =>
          report(
            { file: file.path, line },
            `The event name "${value}" does not follow <context>.<aggregate>.<fact>.`,
            `Name it "${context}.<aggregate>.<fact-in-past-tense>" in kebab-case, for example "${context}.invoice.issued".`,
          ),
        );
    });
  },
};

interface Named {
  readonly line: number;
  readonly value: string;
}

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
