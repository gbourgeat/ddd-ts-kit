import { describe, expect, it } from 'vitest';
import { openApiProblems } from '../src/config';

const CONTEXTS = ['billing', 'shipping'];

function messages(value: unknown): string[] {
  return openApiProblems(value, CONTEXTS).map(({ message }) => message);
}

describe('the openapi value of a config', () => {
  it('says nothing when it is absent, or written as the scripts read it', () => {
    expect(messages(undefined)).toEqual([]);
    expect(messages({ format: 'yaml' })).toEqual([]);

    expect(
      messages({
        documents: [
          { name: 'public', contexts: ['billing'] },
          { name: 'back-office', tags: ['admin'] },
        ],
      }),
    ).toEqual([]);
  });

  it('refuses a value that is not an object, and a format the scripts do not write', () => {
    expect(openApiProblems('yaml', CONTEXTS)).toEqual([
      {
        key: 'openapi',
        message: '"openapi" is not an object.',
        fix: 'Write it as { "format": "yaml" }, or remove it.',
      },
    ]);

    expect(openApiProblems({ format: 'xml' }, CONTEXTS)).toMatchObject([
      {
        key: 'format',
        message: expect.stringContaining('"openapi.format" is "xml"'),
        fix: 'Use one of: yaml, json.',
      },
    ]);
  });

  it('refuses documents that are not a list', () => {
    expect(openApiProblems({ documents: { name: 'public' } }, CONTEXTS)).toMatchObject([
      { key: 'documents', message: '"openapi.documents" is not a list: the contract is one document.' },
    ]);
  });

  it('refuses a document without a file name, with a name that is not kebab-case, or named twice', () => {
    expect(messages({ documents: ['public', { name: 'Back Office', tags: ['admin'] }] })).toEqual([
      'The document 1 of "openapi.documents" has the name undefined: it names its file, openapi/<name>.yaml.',
      'The document 2 of "openapi.documents" has the name "Back Office": it names its file, openapi/<name>.yaml.',
    ]);

    expect(
      openApiProblems(
        {
          documents: [
            { name: 'public', tags: ['a'] },
            { name: 'public', tags: ['b'] },
          ],
        },
        CONTEXTS,
      ),
    ).toEqual([
      { key: 'public', message: 'Two documents are named "public".', fix: 'Give each document its own name.' },
    ]);
  });

  it('refuses a document that holds no route, and one that names a context the config does not declare', () => {
    expect(messages({ documents: [{ name: 'empty' }, { tags: [], contexts: ['billing', 'payments'] }] })).toEqual([
      'The document "empty" names no route group, context or tag: it would hold no route.',
      'The document 2 of "openapi.documents" has the name undefined: it names its file, openapi/<name>.yaml.',
      'The document "documents" names the context "payments", which the config does not declare.',
    ]);
  });
});
