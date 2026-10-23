import { ContractSuite, type Awaitable, type ContractRunner } from '@ddd-ts-kit/testing/contracts';
import type { RelationTuple } from '../rebac/relation-tuple';
import type { RelationTupleStore } from '../rebac/relation-tuple-store';
import { tupleKey } from '../rebac/tuple-key';

export interface RelationTupleStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  create(): Awaitable<RelationTupleStore>;
}

/** What every relation tuple store, in memory or in a database, guarantees to the authorizer. */
export function relationTupleStoreContract(runner: ContractRunner, options: RelationTupleStoreContractOptions): void {
  new TupleStoreSuite(runner, () => options.create()).describe(`${options.name} (relation tuple store contract)`);
}

const adaEdits: RelationTuple = { object: 'document:1', relation: 'editor', subject: 'user:ada' };
const adaViews: RelationTuple = { object: 'document:1', relation: 'viewer', subject: 'user:ada' };
const adamEdits: RelationTuple = { object: 'document:1', relation: 'editor', subject: 'user:adam' };
const teamEdits: RelationTuple = { object: 'document:1', relation: 'editor', subject: 'group:eng' };
const adaEditsAnother: RelationTuple = { object: 'document:10', relation: 'editor', subject: 'user:ada' };
const filedUnderTeam: RelationTuple = { object: 'document:1', relation: 'parent', subject: 'group:eng' };

class TupleStoreSuite extends ContractSuite<RelationTupleStore> {
  protected tests(): void {
    this.readsByObjectAndRelation();
    this.readsBySubject();
    this.writesOnce();
    this.deletes();
  }

  private readsByObjectAndRelation(): void {
    this.it('reads what was written, by object and relation', async () => {
      await this.subject.write([adaEdits, teamEdits]);

      this.expect(sorted(await this.subject.readByObject('document:1', 'editor'))).toEqual(
        sorted([adaEdits, teamEdits]),
      );
    });

    this.it('keeps objects and relations apart', async () => {
      await this.subject.write([adaEdits, adaViews, adaEditsAnother]);

      this.expect(await this.subject.readByObject('document:1', 'viewer')).toEqual([adaViews]);
      this.expect(await this.subject.readByObject('document:10', 'editor')).toEqual([adaEditsAnother]);
      this.expect(await this.subject.readByObject('document:2', 'editor')).toEqual([]);
    });
  }

  private readsBySubject(): void {
    this.it('reads by subject across objects and relations', async () => {
      await this.subject.write([adaEdits, adaViews, adaEditsAnother, adamEdits]);

      this.expect(sorted(await this.subject.readBySubject('user:ada'))).toEqual(
        sorted([adaEdits, adaViews, adaEditsAnother]),
      );
    });

    this.it('matches the subject exactly, whatever it is of: a user, or a group named as itself', async () => {
      await this.subject.write([adamEdits, teamEdits, filedUnderTeam]);

      this.expect(await this.subject.readBySubject('user:ada')).toEqual([]);
      this.expect(sorted(await this.subject.readBySubject('group:eng'))).toEqual(sorted([teamEdits, filedUnderTeam]));
    });
  }

  private writesOnce(): void {
    this.it('stores a tuple written twice once', async () => {
      await this.subject.write([adaEdits]);
      await this.subject.write([adaEdits, adaEdits]);

      this.expect(await this.subject.readByObject('document:1', 'editor')).toEqual([adaEdits]);
    });
  }

  private deletes(): void {
    this.it('deletes the given tuples and no other', async () => {
      await this.subject.write([adaEdits, adamEdits, adaViews]);

      await this.subject.delete([adaEdits]);

      this.expect(await this.subject.readByObject('document:1', 'editor')).toEqual([adamEdits]);
      this.expect(await this.subject.readBySubject('user:ada')).toEqual([adaViews]);
    });

    this.it('accepts the deletion of a tuple that is not there', async () => {
      await this.subject.write([adaEdits]);

      await this.subject.delete([adamEdits]);

      this.expect(await this.subject.readByObject('document:1', 'editor')).toEqual([adaEdits]);
    });
  }
}

function sorted(tuples: readonly RelationTuple[]): readonly RelationTuple[] {
  return [...tuples].sort((left, right) => tupleKey(left).localeCompare(tupleKey(right)));
}
