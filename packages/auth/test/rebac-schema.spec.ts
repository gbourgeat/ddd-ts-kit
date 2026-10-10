import { describe, expect, it } from 'vitest';
import {
  InMemoryRelationTupleStore,
  InvalidTupleError,
  SchemaCheckedTupleStore,
  SchemaError,
  defineSchema,
  exclusion,
  from,
  intersection,
  objectOf,
  parseObject,
  parseSubject,
  union,
  type SchemaDefinition,
} from '../src/rebac.js';
import { fact, schema } from './support/documents.js';

const failure = (definition: SchemaDefinition): string => {
  try {
    defineSchema(definition);
  } catch (error) {
    if (error instanceof SchemaError) return error.message;

    throw error;
  }

  return 'accepted';
};

describe('defineSchema', () => {
  it('resolves a name to a relation or to a permission', () => {
    expect(schema.resolve('document', 'editor')).toEqual({ kind: 'relation', subjects: ['user', 'group#member'] });
    expect(schema.resolve('document', 'sign')).toEqual({ kind: 'permission', rewrite: intersection('approver', 'edit') });
    expect(schema.resolve('document', 'publish')).toBeUndefined();
    expect(schema.resolve('invoice', 'edit')).toBeUndefined();
  });

  it('knows which relations are used as usersets', () => {
    expect(schema.usersetsOf('group')).toEqual(['member']);
    expect(schema.usersetsOf('document')).toEqual([]);
  });

  it('refuses a relation accepting an unknown type', () => {
    expect(failure({ document: { relations: { owner: ['user'] } } })).toBe(
      '"document#owner" accepts the unknown type "user".',
    );
  });

  it('refuses a userset of a relation the type does not have', () => {
    expect(failure({ user: {}, group: {}, document: { relations: { editor: ['group#member'] } } })).toBe(
      '"document#editor" accepts "group#member", but "group" has no "member".',
    );
  });

  it('refuses a permission referring to an unknown relation', () => {
    expect(
      failure({ user: {}, document: { relations: { owner: ['user'] }, permissions: { edit: union('owner', 'editor') } } }),
    ).toBe('"document#edit" refers to "editor", which "document" does not declare.');
  });

  it('refuses to follow something that is not a relation to objects', () => {
    const base = { user: {}, folder: { relations: { owner: ['user'] }, permissions: { edit: 'owner' } } };

    expect(failure({ ...base, document: { permissions: { edit: from('parent', 'edit') } } })).toBe(
      '"document#edit" follows "parent", which is not a relation of "document".',
    );

    expect(
      failure({
        ...base,
        group: { relations: { member: ['user'] } },
        document: { relations: { parent: ['group#member'] }, permissions: { edit: from('parent', 'edit') } },
      }),
    ).toContain('only objects can be followed');
  });

  it('refuses to ask a followed object for a permission it does not declare', () => {
    expect(
      failure({
        user: {},
        folder: { relations: { owner: ['user'] } },
        document: { relations: { parent: ['folder'] }, permissions: { edit: from('parent', 'edit') } },
      }),
    ).toBe('"document#edit" asks "edit" of "folder", which does not declare it.');
  });

  it('refuses one name for a relation and a permission', () => {
    expect(failure({ user: {}, document: { relations: { edit: ['user'] }, permissions: { edit: 'edit' } } })).toBe(
      '"document" declares "edit" both as a relation and as a permission.',
    );
  });

  it('refuses a rewrite that reads no tuple and could never terminate', () => {
    expect(failure({ document: { permissions: { edit: union('view'), view: exclusion('comment', 'edit'), comment: 'edit' } } })).toBe(
      '"document" has a rewrite that cannot terminate: edit -> view -> comment -> edit.',
    );

    expect(failure({ document: { permissions: { edit: 'edit' } } })).toContain('edit -> edit');
  });

  it('accepts a loop that goes through tuples: folders in folders, groups in groups', () => {
    expect(schema.resolve('folder', 'view')?.kind).toBe('permission');
    expect(schema.resolve('group', 'member')?.kind).toBe('relation');
  });

  it('refuses an empty union or intersection, which would grant nobody or everybody', () => {
    expect(failure({ document: { permissions: { edit: union() } } })).toBe('"document#edit" has an empty union.');

    expect(failure({ document: { permissions: { edit: intersection() } } })).toBe(
      '"document#edit" has an empty intersection.',
    );
  });
});

describe('tuples', () => {
  it('reads objects and subjects', () => {
    expect(parseObject('document:1')).toEqual({ type: 'document', id: '1' });
    expect(parseObject('system:system:nightly')).toEqual({ type: 'system', id: 'system:nightly' });
    expect(parseSubject('user:ada')).toEqual({ type: 'user', id: 'ada' });
    expect(parseSubject('group:eng#member')).toEqual({ type: 'group', id: 'eng', relation: 'member' });
    expect(objectOf({ type: 'document', id: '1' })).toBe('document:1');
  });

  it.each(['document', ':1', 'Document:1', 'document:', 'document:a b', 'document:1@x'])('refuses the object %j', (object) => {
    expect(() => parseObject(object)).toThrow(InvalidTupleError);
  });

  it.each(['group:eng#', 'group:eng#member#x', 'group#member', 'group:eng#Member'])('refuses the subject %j', (subject) => {
    expect(() => parseSubject(subject)).toThrow(InvalidTupleError);
  });
});

describe('SchemaCheckedTupleStore', () => {
  const stores = () => {
    const inner = new InMemoryRelationTupleStore();

    return { inner, store: new SchemaCheckedTupleStore(schema, inner) };
  };

  it('stores the tuples the schema describes', async () => {
    const { inner, store } = stores();
    const tuples = [fact('document:1', 'editor', 'user:ada'), fact('document:1', 'editor', 'group:eng#member')];

    await store.write(tuples);

    expect(inner.all()).toEqual(tuples);
    expect(await store.readByObject('document:1', 'editor')).toEqual(tuples);
    expect(await store.readBySubject('user:ada')).toEqual([tuples[0]]);
  });

  it.each([
    [fact('document:1', 'edit', 'user:ada'), '"edit" is not a relation of "document": only relations are written.'],
    [fact('document:1', 'publisher', 'user:ada'), '"publisher" is not a relation of "document": only relations are written.'],
    [fact('document:1', 'owner', 'group:eng#member'), '"document#owner" does not accept a subject of kind "group#member".'],
    [fact('document:1', 'parent', 'user:ada'), '"document#parent" does not accept a subject of kind "user".'],
    [fact('invoice:1', 'owner', 'user:ada'), '"owner" is not a relation of "invoice": only relations are written.'],
  ])('refuses %j', async (tuple, message) => {
    const { inner, store } = stores();

    await expect(store.write([fact('document:1', 'owner', 'user:ada'), tuple])).rejects.toThrow(message);
    expect(inner.all()).toEqual([]);
  });

  it('deletes through', async () => {
    const { inner, store } = stores();

    await store.write([fact('document:1', 'owner', 'user:ada')]);

    await store.delete([fact('document:1', 'owner', 'user:ada')]);

    expect(inner.all()).toEqual([]);
  });
});
