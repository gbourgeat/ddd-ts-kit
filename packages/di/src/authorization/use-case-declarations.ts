import type { UseCaseDeclaration } from './use-case-declaration';

/** What every module declared about the access to its commands and queries, as data. */
export abstract class UseCaseDeclarations {
  static readonly tokenKey = 'di.UseCaseDeclarations';

  abstract readonly list: readonly UseCaseDeclaration[];
}
