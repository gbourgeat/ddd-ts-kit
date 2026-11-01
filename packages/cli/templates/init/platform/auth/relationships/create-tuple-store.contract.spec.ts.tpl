import { beforeEach, describe, expect, it } from '{{tests.module}}';
import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { createTupleStore } from '{{alias.platform}}/auth/relationships/create-tuple-store{{alias.ext}}';

relationTupleStoreContract(
  { describe, it, expect, beforeEach },
  { name: 'The relation tuple store of the platform', create: () => createTupleStore('test') },
);

describe('The relation tuple store of the platform, by environment', () => {
  it('starts in memory in development', () => {
    expect(() => createTupleStore('development')).not.toThrow();
  });

  it('starts in memory in a test run', () => {
    expect(() => createTupleStore('test')).not.toThrow();
  });

  it('refuses production until a store that persists is bound', () => {
    expect(() => createTupleStore('production')).toThrow(/never in production: bind a RelationTupleStore that persists/);
  });
});
