import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { personalNames, type PersonalNames } from './personal-names';
import { personalRequestOf, type PersonalRequest } from './personal-request-of';
import { writePersonalDeclaration } from './write-personal-declaration';

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

  writePersonalDeclaration(scope, context, {
    owner: aggregate,
    spec: 'personal-data/spec.ts.tpl',
    joined: `${aggregate.pascal}PersonalFields joined the declarations of ${names.adapter} and ${names.exportAdapter}: their spec covers the first table of the context, add this one to it.`,
    written: written(scope, { aggregate, request, names }),
  });
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
