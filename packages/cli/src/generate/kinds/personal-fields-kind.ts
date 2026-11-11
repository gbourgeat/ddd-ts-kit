import type { Kind } from '../kind';
import { openScope } from '../open-scope';
import { declareTablePersonalFields } from './personal-data/declare-table-personal-fields';

export const personalFieldsKind: Kind = {
  name: 'personal-fields',
  aliases: [],
  usage:
    'personal-fields <context> <table> --personal <column>,<column>... --subject <column> [--erasure pseudonymise|row] [--retention <column>:<n><d|m|y>] [--tenant-scoped]',
  summary:
    'The declaration of the personal columns of a table no aggregate owns (a read model, a table of received messages, a table written by hand), by its SQL name: next to the adapters, joined to the erasure and to the export of the context, or written with them (ports, adapters, fakes, a spec of it.todo, registration) when it is the first. --subject is required: the row of such a table is rarely the person. The table and its columns are read in the schema of the context and never changed; a column it does not hold is refused. After the table is written in the schema of the context; the table of an aggregate is declared by `generate repository <context> <Aggregate> --personal <column>,...`.',
  positionals: ['context', 'table'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    declareTablePersonalFields(openScope(request), request.args[1] ?? '');
  },
};
