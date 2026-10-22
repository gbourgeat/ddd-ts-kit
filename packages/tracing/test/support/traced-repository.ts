import { traceDependency } from '../../src';
import { AccountRepository } from './account-repository';

export const tracedRepository = (): AccountRepository =>
  traceDependency(new AccountRepository(), { kind: 'repository', context: 'billing' });
