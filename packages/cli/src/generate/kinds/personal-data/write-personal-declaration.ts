import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import { applyWiring } from '../../apply-wiring';
import { emit } from '../../emit';
import { rendered } from '../../rendered';
import type { Scope } from '../../scope';
import { wire } from '../../wire';
import { wiringFamily } from '../../wiring-family';
import { personalNames, type PersonalNames } from './personal-names';

/** One declaration to write: what names its table, the spec the first one of a context brings, and what the command says of each case. */
export interface PersonalDeclaration {
  /** The aggregate of the table, or the table itself when no aggregate owns it: its file and its constant are named after it. */
  readonly owner: Name;
  readonly spec: string;
  /** Said when the erasure of the context exists and the declaration joins it. */
  readonly joined: string;
  /** Said when the declaration is the first of its context, which brings the erasure and the export. */
  readonly written: string;
}

/**
 * The declaration next to the adapters, joined to the erasure and to the export of the context
 * when they exist, written with them when it is the first: ports, adapters, fakes, spec,
 * registration, and their line among the copies and the exports of the platform.
 */
export function writePersonalDeclaration(scope: Scope, context: RenderContext, declaration: PersonalDeclaration): void {
  const { owner } = declaration;
  const names = personalNames(scope.config.stack.orm, scope.context);
  const adapters = [names.adapterKebab, names.exportAdapterKebab].map(adapterFileOf(scope));

  emit(scope, context, [
    [
      `personal-data/declaration.${scope.config.stack.orm}.ts.tpl`,
      `infrastructure/persistence/${owner.kebab}.personal-fields.ts`,
    ],
  ]);

  if (adapters.some((file) => scope.ws.exists(file))) {
    for (const file of adapters) {
      applyWiring(scope.ws, file, rendered(scope, 'personal-data/adapter-field.tpl', context));
    }

    scope.ws.note(declaration.joined);

    return;
  }

  writeErasure(scope, context, { names, spec: declaration.spec });
  writeExport(scope, context, names);
  wire(scope, 'personal-data', context);
  scope.ws.note(declaration.written);
}

function adapterFileOf(scope: Scope): (adapter: string) => string {
  return (adapter) => `${scope.dir}/infrastructure/persistence/${adapter}.repository.ts`;
}

/** The port, the adapter, the fake and the spec of the erasure of the context, listed among the copies the platform erases. */
function writeErasure(
  scope: Scope,
  context: RenderContext,
  { names, spec }: { names: PersonalNames; spec: string },
): void {
  const { orm } = scope.config.stack;

  emit(scope, context, [
    ['personal-data/port.ts.tpl', `application/ports/${names.portKebab}.port.ts`],
    [`personal-data/erasure.${orm}.ts.tpl`, `infrastructure/persistence/${names.adapterKebab}.repository.ts`],
    ['personal-data/fake.ts.tpl', `test/fakes/${names.portKebab}.fake.ts`],
    [spec, `test/integration/${scope.context.kebab}-personal-data.spec.ts`],
  ]);

  listIn(scope, context, 'copies');
}

/** The port, the adapter and the fake of the export of the context, listed among the exports the platform gathers; the spec of the erasure covers it. */
function writeExport(scope: Scope, context: RenderContext, names: PersonalNames): void {
  const { orm } = scope.config.stack;

  emit(scope, context, [
    ['personal-data/export-port.ts.tpl', `application/ports/${names.exportPortKebab}.port.ts`],
    [`personal-data/export.${orm}.ts.tpl`, `infrastructure/persistence/${names.exportAdapterKebab}.repository.ts`],
    ['personal-data/export-fake.ts.tpl', `test/fakes/${names.exportPortKebab}.fake.ts`],
  ]);

  listIn(scope, context, 'exports');
}

/** The port on tsyringe, or the factory of the hand-wired platform, listed once in the file of the platform the script reads. */
function listIn(scope: Scope, context: RenderContext, list: 'copies' | 'exports'): void {
  const family = wiringFamily(scope.config) === 'manual' ? 'manual' : 'container';

  applyWiring(
    scope.ws,
    `${scope.config.platformDir}/privacy/data-subject-${list}.ts`,
    rendered(scope, `personal-data/${list}.${family}.tpl`, context),
  );
}
