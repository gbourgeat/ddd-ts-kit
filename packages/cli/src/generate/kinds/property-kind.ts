import { VERSIONS } from '../../init/manifest/versions';
import { concept } from '../concept';
import { emit } from '../emit';
import { editJson } from './extraction/edit-json';
import type { Kind } from '../kind';
import { named } from '../named';
import { openScope } from '../open-scope';
import { requireFile } from '../require-file';
import type { Scope } from '../scope';
import { recordOf } from './extraction/record-of';
import { vars } from '../vars';

const FAST_CHECK = 'fast-check';

export const propertyKind: Kind = {
  name: 'property',
  aliases: [],
  usage: 'property <context> <ValueObject>',
  summary:
    'The laws of a value object checked on generated values (fast-check): a spec beside its own, with fast-check added to the development dependencies when it is missing.',
  positionals: ['context', 'ValueObject'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);

    const name = concept({ ...scope, flags: { ...scope.flags, allowName: true } }, request.args[1] ?? '', {
      what: 'value object',
      strip: ['vo'],
    });

    requireFile(scope, {
      file: `domain/value-objects/${name.kebab}.vo.ts`,
      what: `The value object ${name.pascal}`,
      createdBy: `ddd-ts-kit generate value-object ${scope.context.kebab} ${name.pascal}`,
    });

    emit(scope, vars(scope, { name: named(name) }), [
      ['property/value-object.properties.spec.ts.tpl', `test/unit/${name.kebab}.vo.properties.spec.ts`],
    ]);

    addFastCheck(scope);
  },
};

/** fast-check joins the development dependencies with the first property; a project that has it keeps its own range. */
function addFastCheck(scope: Scope): void {
  const manifest = scope.ws.read('package.json');

  if (manifest === undefined || manifest.includes(`"${FAST_CHECK}"`)) {
    return;
  }

  editJson(scope.ws, 'package.json', (json) => {
    json['devDependencies'] = sortedByName({
      ...recordOf(json['devDependencies']),
      [FAST_CHECK]: VERSIONS[FAST_CHECK],
    });
  });
}

function sortedByName(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).sort(([one], [other]) => one.localeCompare(other)));
}
