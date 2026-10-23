import { describe, expect, it } from 'vitest';
import { defineSchema } from '@ddd-ts-kit/auth/rebac';
import { OpenFgaModelError, authorizationModelOf, ensureAuthorizationModel, modelDrift, relationNameOf } from '../src';
import { schema } from './support/documents';
import { InMemoryOpenFga } from './support/in-memory-open-fga';

describe('authorizationModelOf', () => {
  it('writes each relation as directly assignable to the subjects it lists, and each derived relation as its rewrite', () => {
    const model = authorizationModelOf(schema);
    const document = model.type_definitions.find(({ type }) => type === 'document');

    expect(model.schema_version).toBe('1.1');
    expect(model.type_definitions.map(({ type }) => type)).toEqual(['user', 'group', 'folder', 'document']);
    expect(model.type_definitions[0]).toEqual({ type: 'user' });
    expect(document?.relations?.['editor']).toEqual({ this: {} });

    expect(document?.metadata?.relations?.['editor']).toEqual({
      directly_related_user_types: [{ type: 'user' }, { type: 'group', relation: 'member' }],
    });

    expect(document?.relations?.['docs_document_edit']).toEqual({
      difference: {
        base: {
          union: {
            child: [
              { computedUserset: { relation: 'owner' } },
              { computedUserset: { relation: 'editor' } },
              { tupleToUserset: { tupleset: { relation: 'folder' }, computedUserset: { relation: 'edit' } } },
            ],
          },
        },
        subtract: { computedUserset: { relation: 'banned' } },
      },
    });

    expect(document?.relations?.['docs_document_sign']).toEqual({
      intersection: {
        child: [{ computedUserset: { relation: 'approver' } }, { computedUserset: { relation: 'docs_document_edit' } }],
      },
    });
  });

  it('names a derived relation after its permission in the words OpenFGA admits', () => {
    expect(relationNameOf('edit')).toBe('edit');
    expect(relationNameOf('docs:document.edit')).toBe('docs_document_edit');

    expect(() => relationNameOf(`docs:${'a'.repeat(50)}`)).toThrow(OpenFgaModelError);

    expect(() =>
      authorizationModelOf(
        defineSchema({
          user: {},
          document: {
            relations: { owner: ['user'], docs_document_edit: ['user'] },
            derived: { 'docs:document.edit': 'owner' },
          },
        }),
      ),
    ).toThrow(new OpenFgaModelError('"document" has two relations that OpenFGA would both call "docs_document_edit".'));
  });
});

describe('modelDrift', () => {
  const expected = authorizationModelOf(schema);

  it('finds nothing between a model and itself as a server gives it back, extra fields and order aside', () => {
    const served = JSON.parse(
      JSON.stringify({ ...expected, id: '01H', type_definitions: [...expected.type_definitions].reverse() }),
    );

    expect(modelDrift(expected, served)).toEqual([]);
  });

  it('names what is missing, extra or changed, and a store without a model', () => {
    const other = authorizationModelOf(
      defineSchema({
        user: {},
        group: { relations: { member: ['user'] } },
        tag: {},
      }),
    );

    expect(modelDrift(expected, undefined)).toEqual(['the store holds no authorization model']);

    expect(modelDrift(expected, other)).toEqual(
      expect.arrayContaining([
        'document is in the schema, not in the store: type',
        'tag is in the store, not in the schema: type',
        'group#member differs: the schema says this [group#member, user], the store this [user]',
      ]),
    );
  });
});

describe('ensureAuthorizationModel', () => {
  it('writes the model of the schema once, and again only when the schema changes', async () => {
    const client = new InMemoryOpenFga();

    const first = await ensureAuthorizationModel(client, schema);
    const again = await ensureAuthorizationModel(client, schema);

    const changed = await ensureAuthorizationModel(
      client,
      defineSchema({
        user: {},
        team: { relations: { member: ['user'] } },
        doc: { relations: { reader: ['team#member'] }, derived: { read: 'reader' } },
      }),
    );

    expect(first.modelId).toBe('model-1');
    expect(first.changes).toEqual(['the store holds no authorization model']);
    expect(again).toEqual({ modelId: 'model-1', changes: [] });
    expect(changed.modelId).toBe('model-2');
    expect(changed.changes.length).toBeGreaterThan(0);
  });
});
