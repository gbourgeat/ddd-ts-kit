import { specifierOf } from '../../../alias';
import { toName } from '../../../naming';
import type { Scope } from '../../scope';
import type { ControllerPlan } from './controller-plan';
import { dtoClasses } from './dto-classes';
import { sharesSchemas } from './shares-schemas';

/** The files a controller stands with, each as the import of the class it exports. */
export interface ControllerImports {
  readonly message: string;
  readonly group: readonly string[];
  /** The class-validator classes of the route, as values: the schemas are built from them. */
  readonly dtos: readonly string[];
  readonly controller: string;
  readonly mapper: string;
  readonly serializer: string;
  readonly result: string;
  /** One class-validator class of the route, imported for its type only. */
  typeOf(role: string): string;
}

export function controllerImports(scope: Scope, plan: ControllerPlan): ControllerImports {
  const { config, context } = scope;
  const { name, endpoint, useCase, group, folder } = plan;
  const inContext = (file: string): string => specifierOf(config, `${config.contextsDir}/${context.kebab}/${file}.ts`);
  const beside = (role: string): string => inContext(`${folder}/${name.kebab}.${role}`);
  const classOf = (role: string): string => `${name.pascal}${toName(role).pascal}`;

  const roles =
    config.stack.validation === 'class-validator' ? dtoClasses(endpoint, useCase, sharesSchemas(config)) : [];

  return {
    message: `import { ${useCase.message} } from '${inContext(useCase.messageFile)}';`,
    group: group === undefined ? [] : [`import { ${group.name.pascal}Routes } from '${inContext(group.file)}';`],
    dtos: roles.map((role) => `import { ${classOf(role)} } from '${beside(role)}';`),
    controller: `import { ${name.pascal}Controller } from '${beside('controller')}';`,
    mapper: `import { ${name.pascal}Mapper } from '${beside('mapper')}';`,
    serializer: `import { ${name.pascal}Serializer } from '${beside('serializer')}';`,
    result: `import type { ${name.pascal}Result } from '${inContext(useCase.messageFile.replace(/\.query$/, '.result'))}';`,
    typeOf: (role) => `import type { ${classOf(role)} } from '${beside(role)}';`,
  };
}
