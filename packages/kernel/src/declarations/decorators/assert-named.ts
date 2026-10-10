import { DeclarationError } from '../registry/declaration-error.js';

export function assertNamed(name: string, complaint: string): void {
  if (name.trim() === '') throw new DeclarationError(`${complaint}, and it is empty.`);
}
