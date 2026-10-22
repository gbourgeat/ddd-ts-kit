import { CliError } from '../../cli-error';
import type { Kind } from '../kind';
import { label } from '../label';
import { openScope } from '../open-scope';
import { entriesOf } from '../vocabulary/entries-of';
import { vocabularyText } from '../vocabulary/vocabulary-text';

export const vocabularyKind: Kind = {
  name: 'vocabulary',
  aliases: [],
  usage: 'vocabulary <context> <Name> --value <value> [--value <value>]...',
  summary:
    'A closed vocabulary of the domain (a status, a kind, a role of the model): an object `as const` of its values and the union type of the same name, so that code reads `AppointmentStatus.NoShow` and never a string; run again, it adds the values the file does not hold yet.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'vocabulary', strip: ['vocabulary'] });

    if (request.flags.value.length === 0) {
      throw new CliError(
        `The vocabulary ${name.pascal} is given no value.`,
        `Pass each value with --value: \`ddd-ts-kit generate vocabulary ${scope.context.kebab} ${name.pascal} --value <value> --value <value>\`.`,
      );
    }

    const file = `${scope.dir}/domain/vocabularies/${name.kebab}.vocabulary.ts`;
    const existing = request.ws.read(file);
    const text = vocabularyText(name.pascal, entriesOf(request.flags.value), existing);

    if (existing === undefined) {
      request.ws.create(file, text);
    } else {
      request.ws.update(file, text);
    }
  },
};
