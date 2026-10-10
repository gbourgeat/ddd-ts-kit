import type { DeclaredClass } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from '../wiring/declarer.js';

const files = new WeakMap<DeclaredClass, string>();

/** Remembers the file a class was discovered in, for the error messages and the description. */
export function rememberFile(target: DeclaredClass, file: string): void {
  files.set(target, file);
}

export function declarerOf(target: DeclaredClass): Declarer {
  const file = files.get(target);

  return { className: target.name, ...(file === undefined ? {} : { file }) };
}
