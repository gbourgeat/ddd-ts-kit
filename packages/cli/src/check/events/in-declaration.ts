import type { EventDeclaration } from './event-declarations.js';

export function inDeclaration(declarations: readonly EventDeclaration[], offset: number): boolean {
  return declarations.some((declaration) => offset > declaration.start && offset < declaration.end);
}
