import type { Declarer } from './declarer.js';

interface Located {
  readonly module: string;
  readonly declaredBy?: Declarer;
}

/** `module "billing"`, followed by the class and the file when a decorator made the declaration. */
export function whereOf({ module, declaredBy }: Located): string {
  if (declaredBy === undefined) {
    return `module "${module}"`;
  }

  const file = declaredBy.file === undefined ? '' : ` in ${declaredBy.file}`;

  return `module "${module}" (declared by class ${declaredBy.className}${file})`;
}
