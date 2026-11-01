import { beforeEach, describe, expect, it } from '{{tests.module}}';
import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { createTupleStore } from '{{alias.platform}}/auth/relationships/create-tuple-store{{alias.ext}}';

relationTupleStoreContract(
  { describe, it, expect, beforeEach },
  { name: 'The relation tuple store of the platform', create: () => createTupleStore('test') },
);

describe('The relation tuple store of the platform, by environment', () => {
  it.each(['development', 'test'])('starts in memory in %s', (environment) => {
    expect(() => createTupleStore(environment)).not.toThrow();
  });

  it('refuses production until a store that persists is bound', () => {
    expect(() => createTupleStore('production')).toThrow(/never in production: bind a RelationTupleStore that persists/);
  });
});
