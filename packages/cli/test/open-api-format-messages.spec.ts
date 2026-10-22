import { describe, expect, it } from 'vitest';
import { openApiProblems } from '../src/config/open-api-problems';

const messagesOf = (openapi: unknown) => openApiProblems(openapi, ['billing']).map(({ message }) => message);

describe('the messages of config/valid on "openapi"', () => {
  it('refuses a format the contracts are not written in, and names both formats they are', () => {
    expect(openApiProblems({ format: 'xml' }, [])).toEqual([
      {
        key: 'format',
        message: '"openapi.format" is "xml", a format the contracts are not written in.',
        fix: 'Use one of: yaml, json.',
      },
    ]);
  });

  it('names the file of a document with the extension of the format the contracts are written in', () => {
    const nameless = [{ title: 'Nameless', contexts: ['billing'] }];

    expect(messagesOf({ documents: nameless })).toEqual([
      'The document 1 of "openapi.documents" has the name undefined: it names its file, openapi/<name>.yaml.',
    ]);

    expect(messagesOf({ format: 'json', documents: nameless })).toEqual([
      'The document 1 of "openapi.documents" has the name undefined: it names its file, openapi/<name>.json.',
    ]);
  });
});
