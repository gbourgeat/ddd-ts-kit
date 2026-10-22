import { CLASSIFICATIONS, CONFIG_FILE, editConfigText, isOneOf } from '../../config/index.js';
import { isRecord } from '../../config/values/is-record.js';
import { MODULE_TECHNICAL_WORDS } from '../../check/modules/module-naming-words.js';
import { withModuleRow } from '../../check/modules/with-module-row.js';
import { CliError } from '../../cli-error.js';
import { isRoleFolder, MODULE_LAYERS } from '../../model-modules/index.js';
import { splitWords, toName, type Name } from '../../naming/index.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { spokenInLanguage } from '../spoken-in-language.js';

export const moduleKind: Kind = {
  name: 'module',
  aliases: [],
  usage:
    'module <context> <module> [--purpose "<what it holds>"] [--classification <core|supporting|generic>] [--term "<Term>=<meaning>"]...',
  summary:
    'A module of the model of a context (Evans, Modules): declared in contexts.<name>.modules, given its row in the "## Modules" table of CONTEXT.md, its terms added to the glossary. Run again, it adds what is missing. Generate into it with --module, move files into it with `ddd-ts-kit move-to-module`.',
  positionals: ['context', 'module'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const module = moduleName(scope, request.args[1] ?? '');
    const doc = `${scope.dir}/CONTEXT.md`;

    declareModule(scope, module.kebab);
    scope.ws.update(doc, withModuleRow(scope.ws.read(doc) ?? '', module.kebab, scope.flags.purpose));

    scope.ws.note(
      `Generate into the module with \`--module ${module.kebab}\`, or move files of ${scope.context.kebab} into it with \`ddd-ts-kit move-to-module ${scope.context.kebab} ${module.kebab} <path>...\`, one cluster of concepts per commit.`,
    );
  },
};

/** A part of the model, named in the language of its context: never a role folder, never a technical grouping. */
function moduleName(scope: Scope, input: string): Name {
  const name = toName(input);

  if (name.kebab === '' || MODULE_LAYERS.some((layer) => isRoleFolder(layer, name.kebab))) {
    throw new CliError(
      `"${input}" cannot name a module of the model.`,
      'A module is one folder level under domain/ and application/, named after the cluster of concepts it holds, never after a role folder.',
    );
  }

  const technical = splitWords(name.pascal).find((word) => MODULE_TECHNICAL_WORDS.includes(word));

  if (technical !== undefined) {
    throw new CliError(
      `"${name.kebab}" names a grouping of code ("${technical}"), not a part of the model.`,
      'Name the module after the concepts it holds, with terms of the glossary; what several modules share belongs to one of them, or to a module named after that shared concept (rule module/declared).',
    );
  }

  spokenInLanguage(scope, name);

  return name;
}

function declareModule(scope: Scope, module: string): void {
  const { classification } = scope.flags;

  if (classification !== undefined && !isOneOf(CLASSIFICATIONS, classification)) {
    throw new CliError(
      `Unknown classification "${classification}".`,
      `Pass --classification with one of: ${CLASSIFICATIONS.join(', ')}, or leave it out when the module is classified as its context.`,
    );
  }

  const text = scope.ws.read(CONFIG_FILE);

  if (text === undefined) {
    return;
  }

  scope.ws.update(
    CONFIG_FILE,
    editConfigText(text, (raw) => {
      const context = isRecord(raw['contexts']) ? raw['contexts'][scope.context.kebab] : undefined;

      if (!isRecord(context)) {
        return;
      }

      const modules = isRecord(context['modules']) ? context['modules'] : {};
      const known = isRecord(modules[module]) ? modules[module] : {};

      context['modules'] = {
        ...modules,
        [module]: classification === undefined ? known : { ...known, classification },
      };
    }),
  );
}
