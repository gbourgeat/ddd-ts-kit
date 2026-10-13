import type { BindingKind } from './binding-kind.js';

/** What the message asks for: the name the code already gives to the concept, or how to find one. */
export function bindingAdvice(kind: BindingKind, suggestion: string | undefined): string {
  if (kind === 'loop variable') {
    return suggestion === undefined
      ? 'Name it after one element of the collection, in the singular (`for (const reminder of dueReminders)`).'
      : `Name it after one element of the collection, in the singular: \`${suggestion}\`.`;
  }

  return suggestion === undefined
    ? 'Name it after the concept it holds, a term of the glossary of the context (CONTEXT.md).'
    : `Name it \`${suggestion}\`, the name the code already gives to what it holds.`;
}
