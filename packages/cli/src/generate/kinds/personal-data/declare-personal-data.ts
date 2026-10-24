import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import { applyWiring } from '../../apply-wiring';
import { emit } from '../../emit';
import { rendered } from '../../rendered';
import type { Scope } from '../../scope';
import { wire } from '../../wire';
import { wiringFamily } from '../../wiring-family';
import { personalNames, type PersonalNames } from './personal-names';
import { personalRequestOf } from './personal-request-of';

/**
 * `--personal`: the declaration of the personal columns of the table, next to its mapper, and the
 * erasure of the context that reads every such declaration: its port, its adapter over the erasure
 * of the ORM package, its fake and its spec, written once per context and listed once in the copies
 * of the platform; a later table of the same context joins the declarations of that adapter.
 */
export function declarePersonalData(scope: Scope, aggregate: Name, context: RenderContext): void {
  const request = personalRequestOf(scope);

  if (request === undefined) {
    return;
  }

  const names = personalNames(scope.config.stack.orm, scope.context);
  const adapterFile = `${scope.dir}/infrastructure/persistence/${names.adapterKebab}.repository.ts`;

  emit(scope, context, [
    [
      `personal-data/declaration.${scope.config.stack.orm}.ts.tpl`,
      `infrastructure/persistence/${aggregate.kebab}.personal-fields.ts`,
    ],
  ]);

  if (scope.ws.exists(adapterFile)) {
    applyWiring(scope.ws, adapterFile, rendered(scope, 'personal-data/erasure-field.tpl', context));

    scope.ws.note(
      `${aggregate.pascal}PersonalFields joined the declarations of ${names.adapter}: its spec covers the first table of the context, add this one to it.`,
    );

    return;
  }

  writeErasure(scope, context, names);

  scope.ws.note(
    `${names.port} erases what ${scope.context.kebab} keeps of a person: ${request.fields.join(', ')} of ${aggregate.table}, ${request.erasure === 'row' ? 'the row deleted' : 'each read as [erased]'} for the person ${request.subject} names. \`npm run privacy:erase -- <subject-id>\` runs it with the copies of the other contexts; the mapper of ${aggregate.pascal} does not write those columns yet.`,
  );
}

/** The port, the adapter, the fake and the spec of the erasure of the context, bound where the project binds its adapters and listed among the copies the platform erases. */
function writeErasure(scope: Scope, context: RenderContext, names: PersonalNames): void {
  const { orm } = scope.config.stack;
  const { platformDir } = scope.config;
  const copies = wiringFamily(scope.config) === 'manual' ? 'manual' : 'tsyringe';

  emit(scope, context, [
    ['personal-data/port.ts.tpl', `application/ports/${names.portKebab}.port.ts`],
    [`personal-data/erasure.${orm}.ts.tpl`, `infrastructure/persistence/${names.adapterKebab}.repository.ts`],
    ['personal-data/fake.ts.tpl', `test/fakes/${names.portKebab}.fake.ts`],
    ['personal-data/spec.ts.tpl', `test/integration/${names.portKebab}.spec.ts`],
  ]);

  wire(scope, 'personal-data', context);

  applyWiring(
    scope.ws,
    `${platformDir}/privacy/data-subject-copies.ts`,
    rendered(scope, `personal-data/copies.${copies}.tpl`, context),
  );
}
