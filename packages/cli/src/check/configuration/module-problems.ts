import { CLASSIFICATIONS, isOneOf, type ContextConfig } from '../../config';
import { moduleNameFlaw } from '../../model-modules';
import { isRecord } from '../support/is-record';

/** What is wrong with one module of the model a context declares: the text to place the finding on, and what to say. */
export interface ModuleProblem {
  readonly needle: string;
  readonly message: string;
  readonly fix: string;
}

const SHAPE =
  'Write it as an object of the modules by name, each an object: "modules": { "calendars": {}, "waitlist": { "classification": "supporting" } }.';

/**
 * What `contexts.<name>.modules` says wrongly: written in another shape than the one read (the
 * modules would be silently missed), a module that cannot be a folder of the tree, or an unknown
 * classification. `written` is the key as the file holds it.
 */
export function moduleProblems(context: string, { modules }: ContextConfig, written: unknown): ModuleProblem[] {
  if (written === undefined) {
    return [];
  }

  if (!isRecord(written)) {
    return [
      {
        needle: 'modules',
        message: `contexts.${context}.modules is not an object: no module of "${context}" is read.`,
        fix: SHAPE,
      },
    ];
  }

  const shapes = Object.entries(written)
    .filter(([, value]) => !isRecord(value))
    .map(([name]) => ({
      needle: name,
      message: `The module "${name}" of "${context}" is not written as an object.`,
      fix: SHAPE,
    }));

  return [...shapes, ...namingProblems(context, modules)];
}

function namingProblems(context: string, modules: ContextConfig['modules']): ModuleProblem[] {
  return modules.flatMap(({ name, classification }) => {
    const problems = nameProblems(context, name);

    if (classification !== undefined && !isOneOf(CLASSIFICATIONS, classification)) {
      problems.push({
        needle: name,
        message: `The module "${name}" of "${context}" has the classification "${classification}".`,
        fix: `Set contexts.${context}.modules.${name}.classification to one of: ${CLASSIFICATIONS.join(', ')}, or leave it out when the module is classified as its context.`,
      });
    }

    return problems;
  });
}

/** What to say of a name that cannot be a folder of the tree of its context, by the reason `moduleNameFlaw` gives; a technical word is for the rule module/declared. */
const REFUSED_NAMES: Readonly<Record<string, (name: string, context: string) => Omit<ModuleProblem, 'needle'>>> = {
  format: (name, context) => ({
    message: `The module "${name}" of "${context}" is not written in kebab-case.`,
    fix: `Name it as its folder is named, in kebab-case: <module>/, holding <module>/domain/, <module>/application/...`,
  }),
  'role-folder': (name, context) => ({
    message: `The module "${name}" of "${context}" has the name of a role folder.`,
    fix: 'A module is a part of the model, named in its language; its layers keep their role folders under it (<module>/domain/aggregates/).',
  }),
  'shared-folder': (name, context) => ({
    message: `The module "${name}" of "${context}" takes the name of the folder ${name}/.`,
    fix: `${name}/ is where a context divided into modules keeps what belongs to none of its modules (the schema of its database, its route groups, what its specs share): it is never declared. Name the module after the cluster of concepts it holds.`,
  }),
};

function nameProblems(context: string, name: string): ModuleProblem[] {
  const refused = REFUSED_NAMES[moduleNameFlaw(name)?.reason ?? ''];

  return refused === undefined ? [] : [{ needle: name, ...refused(name, context) }];
}
