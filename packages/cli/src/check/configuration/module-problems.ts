import { CLASSIFICATIONS, isOneOf, type ContextConfig } from '../../config/index.js';
import { isRoleFolder, MODULE_LAYERS } from '../../model-modules/index.js';

/** What is wrong with one module of the model a context declares: the text to place the finding on, and what to say. */
export interface ModuleProblem {
  readonly needle: string;
  readonly message: string;
  readonly fix: string;
}

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The modules of `contexts.<name>.modules` that cannot be a folder of the tree, or carry an unknown classification. */
export function moduleProblems(context: string, { modules }: ContextConfig): ModuleProblem[] {
  return modules.flatMap(({ name, classification }) => {
    const problems: ModuleProblem[] = [];

    if (!KEBAB.test(name)) {
      problems.push({
        needle: name,
        message: `The module "${name}" of "${context}" is not written in kebab-case.`,
        fix: `Name it as its folder is named, in kebab-case: domain/<module>/ and application/<module>/.`,
      });
    } else if (MODULE_LAYERS.some((layer) => isRoleFolder(layer, name))) {
      problems.push({
        needle: name,
        message: `The module "${name}" of "${context}" has the name of a role folder.`,
        fix: 'A module is a part of the model, named in its language; domain/ and application/ keep their role folders under that name.',
      });
    }

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
