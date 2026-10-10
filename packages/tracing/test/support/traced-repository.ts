import { traceDependency } from '../../src/index.js';
import { AccountRepository } from './account-repository.js';

export const tracedRepository = (): AccountRepository =>
  traceDependency(new AccountRepository(), { kind: 'repository', context: 'billing' });
