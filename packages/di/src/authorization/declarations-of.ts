import type { Wiring } from '../wiring/wiring.js';
import type { UseCaseDeclaration } from './use-case-declaration.js';

export function declarationsOf(wiring: Wiring): readonly UseCaseDeclaration[] {
  return wiring.handlings.map(({ kind, message, module, requirement }) => ({ kind, message, module, ...requirement }));
}
