/**
 * The ports of every context (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`),
 * modules included: abstract classes with abstract members only (`ports/abstract-class`), no
 * behaviour to cover, and never loaded where a module file wires the adapters by hand.
 */
export function portFiles(contextsDir: string): string[] {
  return [`${contextsDir}/**/domain/repositories/*.repository.ts`, `${contextsDir}/**/application/ports/*.port.ts`];
}
