import { describe, expect, it } from 'vitest';
import {
  InMemoryRelationTupleStore,
  InvalidTupleError,
  SchemaCheckedTupleStore,
  SchemaError,
  defineSchema,
  objectOf,
  parseObject,
  via,
  type SchemaDefinition,
} from '../src/rebac';
import { docsPermissions, fact, schema } from './support/documents';

const failure = (definition: SchemaDefinition): string => {
  try {
    defineSchema(definition);
  } catch (error) {
    if (error instanceof SchemaError) {
      return error.message;
    }

    throw error;
  }

  return 'accepted';
};

describe('defineSchema', () => {
  it('tells a stored relation from a derived one', () => {
    expect(schema.relations('document')['editor']).toEqual(['user', 'group#member']);

    expect(schema.derived('document')[docsPermissions['document.sign'].id]).toEqual({
      allOf: ['approver', docsPermissions['document.edit'].id],
    });

    expect(schema.declares('document', 'editor')).toBe(true);
    expect(schema.declares('document', 'publish')).toBe(false);
    expect(schema.declares('invoice', 'edit')).toBe(false);
  });

  it('knows what a subject stands for in a relation', () => {
    expect(schema.acceptedKindOf('document', 'editor', 'group')).toBe('group#member');
    expect(schema.acceptedKindOf('document', 'parent', 'folder')).toBe('folder');
    expect(schema.acceptedKindOf('document', 'owner', 'group')).toBeUndefined();

    expect(schema.standsFor('document', 'editor', 'group')).toBe('member');
    expect(schema.standsFor('document', 'editor', 'user')).toBeUndefined();
    expect(schema.standsFor('document', 'parent', 'folder')).toBeUndefined();
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

  it('refuses a relation accepting one type in two ways, since a tuple names the element alone', () => {
    const group = { relations: { member: ['user'], owner: ['user'] } };

    expect(failure({ user: {}, group, document: { relations: { editor: ['group', 'group#member'] } } })).toBe(
      '"document#editor" accepts both "group" and "group#member": a tuple naming a group could not say which. Accept one of them.',
    );

    expect(
      failure({ user: {}, group, document: { relations: { editor: ['group#member', 'group#owner'] } } }),
    ).toContain('accepts both "group#member" and "group#owner"');
  });

  it('refuses a way naming something the type does not declare', () => {
    expect(
      failure({
        user: {},
        document: { relations: { owner: ['user'] }, derived: { edit: { anyOf: ['owner', 'editor'] } } },
      }),
    ).toBe('"document#edit" names "editor", which "document" does not declare.');
  });

  it('refuses to follow something that is not a relation to elements', () => {
    const base = { user: {}, folder: { relations: { owner: ['user'] }, derived: { edit: 'owner' } } };

    expect(failure({ ...base, document: { derived: { edit: via('parent', 'edit') } } })).toBe(
      '"document#edit" follows "parent", which is not a relation of "document".',
    );

    expect(
      failure({
        ...base,
        group: { relations: { member: ['user'] } },
        document: { relations: { parent: ['group#member'] }, derived: { edit: via('parent', 'edit') } },
      }),
    ).toBe('"document#edit" follows "parent", which accepts "group#member": only elements can be followed.');
  });

  it('refuses to ask a followed element for something it does not declare', () => {
    expect(
      failure({
        user: {},
        folder: { relations: { owner: ['user'] } },
        document: { relations: { parent: ['folder'] }, derived: { edit: via('parent', 'edit') } },
      }),
    ).toBe('"document#edit" asks "edit" of "folder", which does not declare it.');
  });

  it('refuses one name for a relation and a derived relation', () => {
    expect(failure({ user: {}, document: { relations: { edit: ['user'] }, derived: { edit: 'edit' } } })).toBe(
      '"document" declares "edit" both as a relation and as a derived relation.',
    );
  });

  it('refuses a derived relation that reads no tuple and could never terminate', () => {
    expect(
      failure({
        document: {
          derived: { edit: { anyOf: ['view'] }, view: { anyOf: ['comment'], butNot: ['edit'] }, comment: 'edit' },
        },
      }),
    ).toBe('"document" has a derived relation that cannot terminate: edit -> view -> comment -> edit.');

    expect(failure({ document: { derived: { edit: 'edit' } } })).toContain('edit -> edit');
  });

  it('accepts a loop that goes through tuples: folders in folders, groups in groups', () => {
    expect(schema.derived('folder')[docsPermissions['folder.view'].id]).toBeDefined();
    expect(schema.relations('group')['member']).toEqual(['user', 'group#member']);
  });

  it('refuses a derived relation with no way of being held, which would grant nobody or everybody', () => {
    const message = '"document#edit" has no way of being held: give anyOf or allOf.';

    expect(failure({ document: { derived: { edit: {} } } })).toBe(message);
    expect(failure({ document: { derived: { edit: { anyOf: [] } } } })).toBe(message);

    expect(
      failure({ user: {}, document: { relations: { banned: ['user'] }, derived: { edit: { butNot: ['banned'] } } } }),
    ).toBe(message);
  });
});

describe('tuples', () => {
  it('reads objects', () => {
    expect(parseObject('document:1')).toEqual({ type: 'document', id: '1' });
    expect(parseObject('system:system:nightly')).toEqual({ type: 'system', id: 'system:nightly' });
    expect(objectOf({ type: 'document', id: '1' })).toBe('document:1');
  });

  it.each(['document', ':1', 'Document:1', 'document:', 'document:a b', 'document:1@x', 'group:eng#member'])(
    'refuses the object %j',
    (object) => {
      expect(() => parseObject(object)).toThrow(InvalidTupleError);
    },
  );
});

describe('SchemaCheckedTupleStore', () => {
  const stores = () => {
    const inner = new InMemoryRelationTupleStore();

    return { inner, store: new SchemaCheckedTupleStore(schema, inner) };
  };

  it('stores the tuples the schema describes', async () => {
    const { inner, store } = stores();
    const tuples = [fact('document:1', 'editor', 'user:ada'), fact('document:1', 'editor', 'group:eng')];

    await store.write(tuples);

    expect(inner.all()).toEqual(tuples);
    expect(await store.readByObject('document:1', 'editor')).toEqual(tuples);
    expect(await store.readBySubject('user:ada')).toEqual([tuples[0]]);
  });

  it.each([
    [fact('document:1', 'edit', 'user:ada'), '"edit" is not a relation of "document": only relations are written.'],
    [
      fact('document:1', 'publisher', 'user:ada'),
      '"publisher" is not a relation of "document": only relations are written.',
    ],
    [fact('document:1', 'owner', 'group:eng'), '"document#owner" does not accept a subject of type "group".'],
    [fact('document:1', 'parent', 'user:ada'), '"document#parent" does not accept a subject of type "user".'],
    [fact('invoice:1', 'owner', 'user:ada'), '"owner" is not a relation of "invoice": only relations are written.'],
    [
      fact('document:1', 'editor', 'group:eng#member'),
      '"group:eng#member" is not a subject: name the element, "group:eng", and let the schema say what it stands for.',
    ],
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
