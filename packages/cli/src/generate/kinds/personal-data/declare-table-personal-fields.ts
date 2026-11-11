import { CliError } from '../../../cli-error';
import { readPersonalData } from '../../../docs/read-personal-data';
import { treeOf } from '../../../model-modules';
import { toName, type Name } from '../../../naming';
import { named } from '../../named';
import type { Scope } from '../../scope';
import { vars } from '../../vars';
import { tenantVars } from '../generate-repository';
import { repositoryPrefix } from '../repository-prefix';
import { columnsOfTable } from './columns-of-table';
import { personalNames } from './personal-names';
import type { PersonalRequest } from './personal-request-of';
import { personalRequestOfTable } from './personal-request-of-table';
import { personalVarsOf } from './personal-vars';
import { tableOfSchema, type FoundTable } from './table-of-schema';
import { writePersonalDeclaration } from './write-personal-declaration';

/**
 * `generate personal-fields <context> <table>`: the declaration of the personal columns of a
 * table no aggregate owns (a read model, a table of received messages, a table written by hand),
 * joined to the erasure and to the export of the context, or written with them when it is the
 * first. The table is the project's own: it is read in the schema of the context, never changed,
 * and no repository nor builder writes its rows, so the spec of a first declaration names each
 * case to prove as `it.todo`.
 */
export function declareTablePersonalFields(scope: Scope, name: string): void {
  const request = personalRequestOfTable(scope);
  const found = tableOfSchema(scope, name);
  const owner = ownerOf(found);

  refuseSecondDeclaration(scope, owner);

  const tenant = tenantVars(scope);
  const { columnOf, unread } = columnsOfTable(found, request, tenant.scoped === true);

  const context = vars(scope, {
    aggregate: named(owner),
    adapter: repositoryPrefix(scope.config.stack.orm),
    tenant,
    personal: { ...personalVarsOf(scope, request, columnOf), ofTable: true },
  });

  writePersonalDeclaration(scope, context, {
    owner,
    spec: 'personal-data/spec.table.ts.tpl',
    joined: joined(scope, owner),
    written: written(scope, owner, request),
  });

  if (unread.length > 0) {
    scope.ws.note(
      `The definition of ${owner.table} in ${found.file} takes columns from elsewhere (a spread, a helper), and ${unread.join(', ')} could not be read in it: check that the table holds ${unread.length === 1 ? 'it' : 'them'}. This generator adds no column to a table.`,
    );
  }
}

/** The table as the templates name what a declaration is about: its file and its constant after the table, its definition as the schema exports it. */
function ownerOf({ table }: FoundTable): Name {
  return { ...toName(table.name), table: table.name, tableCamel: table.reference };
}

/** One declaration per table: the file this command would write, or a declaration of the context that names the table already. */
function refuseSecondDeclaration(scope: Scope, owner: Name): void {
  const target = `${scope.dir}/infrastructure/persistence/${owner.kebab}.personal-fields.ts`;
  const declared = readPersonalData(scope.ws, treeOf(scope.config, scope.context.kebab));
  const file = declared.find((declaration) => declaration.table === owner.table)?.file;

  if (file === undefined && !scope.ws.exists(target)) {
    return;
  }

  throw new CliError(
    `${file ?? scope.ws.placed(target)} already declares what the table ${owner.table} keeps of a person.`,
    'A table has one declaration: add the column to its `fields` there (a key of a file to its `files`), by hand.',
  );
}

function joined(scope: Scope, owner: Name): string {
  const names = personalNames(scope.config.stack.orm, scope.context);

  return `${owner.pascal}PersonalFields joined the declarations of ${names.adapter} and ${names.exportAdapter}: their spec (test/integration/${scope.context.kebab}-personal-data.spec.ts) covers the tables declared before, add this one to it.`;
}

function written(scope: Scope, owner: Name, request: PersonalRequest): string {
  const names = personalNames(scope.config.stack.orm, scope.context);
  const context = scope.context.kebab;
  const mode = request.erasure === 'row' ? 'the row deleted' : 'each read as [erased]';
  const purged = request.retention === undefined ? '' : ', purged once its retention ended';

  return `${names.port} erases and ${names.exportPort} hands over what ${context} keeps of a person: ${request.fields.join(', ')} of ${owner.table}, ${mode} for the person ${request.subject} names. \`npm run privacy:erase -- <subject-id>\` and \`npm run privacy:export -- <subject-id>\` run them with the other contexts. No aggregate owns ${owner.table}, so no repository nor builder writes its rows for a test: test/integration/${context}-personal-data.spec.ts names as it.todo each case to prove on the test database (erased for the subject and left to the others, exported${purged}), with rows inserted as the project writes that table.`;
}
