import { posix } from 'node:path';

/** A production file of a module of the model: its path relative to the context, its module left out, and that module. */
export interface ModuleFile {
  readonly path: string;
  readonly module: string;
}

/** What a file of the tests is named after, by its suffix, and the role folders its subject sits in; every folder for a spec. */
const SUBJECTS: readonly { readonly suffix: string; readonly folders: readonly string[] }[] = [
  { suffix: '.builder.ts', folders: ['domain/aggregates/'] },
  { suffix: '.fake.ts', folders: ['domain/repositories/', 'application/ports/'] },
  { suffix: '.spec.ts', folders: [''] },
];

/**
 * The module of the production file a file of the tests is named after, the longest name winning:
 * a spec after any file (`appointment.repository.contract.spec.ts` is of `appointment.repository.ts`),
 * a builder after an aggregate (`invoice.builder.ts` is of `invoice.aggregate.ts`), a fake after a
 * repository or a port (`payment-gateway.fake.ts` is of `payment-gateway.port.ts`).
 */
export function subjectModule(file: string, production: readonly ModuleFile[]): string | undefined {
  const name = posix.basename(file);
  const subject = SUBJECTS.find(({ suffix }) => name.endsWith(suffix));

  if (subject === undefined) {
    return undefined;
  }

  const stem = name.slice(0, -subject.suffix.length);
  // A spec carries the whole name of its subject; a builder or a fake names it without its role.
  const whole = subject.suffix === '.spec.ts';

  const matches = production
    .filter(({ path }) => subject.folders.some((folder) => path.startsWith(folder)))
    .flatMap(({ path, module }) => {
      const named = posix.basename(path).replace(/\.ts$/, '');

      const fits = whole
        ? stem === named || stem.startsWith(`${named}.`)
        : named === stem || named.startsWith(`${stem}.`);

      return fits ? [{ module, length: named.length }] : [];
    });

  return matches.sort((left, right) => right.length - left.length)[0]?.module;
}
