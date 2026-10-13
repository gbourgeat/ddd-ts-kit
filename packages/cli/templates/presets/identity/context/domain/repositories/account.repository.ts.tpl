import { Repository } from '@ddd-ts-kit/kernel';
import type { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';

/** The accounts, by the subject the identity provider gives each person. */
export abstract class AccountRepository extends Repository<Account> {}
