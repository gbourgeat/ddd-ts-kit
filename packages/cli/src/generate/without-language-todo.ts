/** The marker a new CONTEXT.md opens its glossary with, and the blank line after it. */
const LANGUAGE_TODO = /TODO\(domain\): define the ubiquitous language first[^\n]*\n\n/;

/** A CONTEXT.md whose glossary holds terms: the marker that asks for the first one has nothing left to ask. */
export function withoutLanguageTodo(contextDoc: string): string {
  return contextDoc.replace(LANGUAGE_TODO, '');
}
