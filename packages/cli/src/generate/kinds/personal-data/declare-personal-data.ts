import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import { applyWiring } from '../../apply-wiring';
import { emit } from '../../emit';
import { rendered } from '../../rendered';
import type { Scope } from '../../scope';
import { wire } from '../../wire';
import { wiringFamily } from '../../wiring-family';
import { personalNames, type PersonalNames } from './personal-names';
import { personalRequestOf, type PersonalRequest } from './personal-request-of';

/**
 * `--personal`: the declaration of the personal columns of the table, next to its mapper, and the
 * erasure and the export of the context that read every such declaration: their ports, their
 * adapters over the ones of the ORM package, their fakes and one spec, written once per context and
 * listed once in the copies and in the exports of the platform; a later table of the same context
 * joins the declarations of both adapters.
 */
export function declarePersonalData(scope: Scope, aggregate: Name, context: RenderContext): void {
  const request = personalRequestOf(scope);

  if (request === undefined) {
    return;
  }

  const names = personalNames(scope.config.stack.orm, scope.context);
  const adapters = [names.adapterKebab, names.exportAdapterKebab].map(adapterFileOf(scope));

  emit(scope, context, [
    [
      `personal-data/declaration.${scope.config.stack.orm}.ts.tpl`,
      `infrastructure/persistence/${aggregate.kebab}.personal-fields.ts`,
    ],
  ]);

  if (adapters.some((file) => scope.ws.exists(file))) {
    for (const file of adapters) {
      applyWiring(scope.ws, file, rendered(scope, 'personal-data/adapter-field.tpl', context));
    }

    scope.ws.note(
      `${aggregate.pascal}PersonalFields joined the declarations of ${names.adapter} and ${names.exportAdapter}: their spec covers the first table of the context, add this one to it.`,
    );

    return;
  }

  writeErasure(scope, context, names);
  writeExport(scope, context, names);
  wire(scope, 'personal-data', context);
  scope.ws.note(written(scope, { aggregate, request, names }));
}

function adapterFileOf(scope: Scope): (adapter: string) => string {
  return (adapter) => `${scope.dir}/infrastructure/persistence/${adapter}.repository.ts`;
}

/** The port, the adapter, the fake and the spec of the erasure of the context, listed among the copies the platform erases. */
function writeErasure(scope: Scope, context: RenderContext, names: PersonalNames): void {
  const { orm } = scope.config.stack;

  emit(scope, context, [
    ['personal-data/port.ts.tpl', `application/ports/${names.portKebab}.port.ts`],
    [`personal-data/erasure.${orm}.ts.tpl`, `infrastructure/persistence/${names.adapterKebab}.repository.ts`],
    ['personal-data/fake.ts.tpl', `test/fakes/${names.portKebab}.fake.ts`],
    ['personal-data/spec.ts.tpl', `test/integration/${scope.context.kebab}-personal-data.spec.ts`],
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
  const family = wiringFamily(scope.config) === 'manual' ? 'manual' : 'tsyringe';

  applyWiring(
    scope.ws,
    `${scope.config.platformDir}/privacy/data-subject-${list}.ts`,
    rendered(scope, `personal-data/${list}.${family}.tpl`, context),
  );
}

/** The declaration, the erasure and the export, as the first table of a context brings them. */
interface Written {
  readonly aggregate: Name;
  readonly request: PersonalRequest;
  readonly names: PersonalNames;
}

function written(scope: Scope, { aggregate, request, names }: Written): string {
  const mode = request.erasure === 'row' ? 'the row deleted' : 'each read as [erased]';

  return `${names.port} erases and ${names.exportPort} hands over what ${scope.context.kebab} keeps of a person: ${request.fields.join(', ')} of ${aggregate.table}, ${mode} for the person ${request.subject} names. \`npm run privacy:erase -- <subject-id>\` and \`npm run privacy:export -- <subject-id>\` run them with the other contexts; the mapper of ${aggregate.pascal} does not write those columns yet.`;
}
