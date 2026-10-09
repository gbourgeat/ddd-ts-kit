import { eventDeclarations, inDeclaration, isTypeLiteral, type EventDeclaration } from '../event-declarations.js';
import type { Rule, SourceFile } from '../types.js';
import { inContext, KEBAB_SEGMENT, reporter, type Finding } from './helpers.js';

export const eventsDefinedInPublishedLanguage: Rule = {
  id: 'events/defined-in-published-language',
  description: "An integration event is declared once with defineIntegrationEvent in the producer's published-language/, with a payload schema.",
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const declared = new Map<string, string>();
    return project.files
      .filter((file) => !file.isTest)
      .flatMap((file) => {
        const declarations = eventDeclarations(file);
        const isPublished = inContext(file.location) && file.location.layer === 'published-language';
        const findings = isPublished ? [...judged(file, declarations, declared), ...handwritten(file, declarations)] : misplaced(file, declarations);
        return findings.map(({ line, message, fix }) => report({ file: file.path, line }, message, fix));
      });
  },
};

function misplaced(file: SourceFile, declarations: readonly EventDeclaration[]): Finding[] {
  return declarations.map((declaration) => ({
    line: file.scan.lineAt(declaration.start),
    message: 'An integration event is declared outside a published language.',
    fix: `Move the declaration to the published-language/ folder of the context that produces the event (\`ddd-ts-kit generate integration-event <context> <Aggregate> <Fact>\` creates it) and import it from there.`,
  }));
}

/** `declared` remembers, across the files of the project, where each version of an event was first seen. */
function judged(file: SourceFile, declarations: readonly EventDeclaration[], declared: Map<string, string>): Finding[] {
  return declarations.flatMap((declaration) => {
    const line = file.scan.lineAt(declaration.start);
    return [...withoutPayload(declaration, line), ...declaredTwice({ declaration, line, file: file.path }, declared)];
  });
}

function withoutPayload(declaration: EventDeclaration, line: number): Finding[] {
  if (declaration.hasPayload) return [];
  return [
    {
      line,
      message: `The integration event ${declaration.type?.value ?? ''} is declared without a payload schema.`,
      fix: 'Add `payload: <schema>` to the declaration, written with the schema library of the project: it types the event, validates what is published and feeds the catalog.',
    },
  ];
}

function declaredTwice({ declaration, line, file }: { declaration: EventDeclaration; line: number; file: string }, declared: Map<string, string>): Finding[] {
  if (declaration.type === undefined) return [];
  const key = `${declaration.type.value}@${declaration.version}`;
  const first = declared.get(key);
  if (first === undefined) {
    declared.set(key, file);
    return [];
  }
  return [
    {
      line,
      message: `Version ${declaration.version} of ${declaration.type.value} is already declared in ${first}.`,
      fix: 'Keep one declaration per event type and version; a breaking change of the payload is a new version with its own declaration.',
    },
  ];
}

function handwritten(file: SourceFile, declarations: readonly EventDeclaration[]): Finding[] {
  return file.scan.strings
    .filter((literal) => isTypeLiteral(file, literal.start) && looksLikeEventType(literal.value) && !inDeclaration(declarations, literal.start))
    .map((literal) => ({
      line: literal.line,
      message: `The event "${literal.value}" is described by hand instead of being declared.`,
      fix: `Declare it with defineIntegrationEvent({ type: '${literal.value}', version, payload }) from @ddd-ts-kit/events and derive its types from the declaration.`,
    }));
}

function looksLikeEventType(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => KEBAB_SEGMENT.test(part));
}
