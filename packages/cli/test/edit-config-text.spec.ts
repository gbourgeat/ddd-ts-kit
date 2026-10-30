import { describe, expect, it } from 'vitest';
import { editConfigText } from '../src/config';

describe('the config text edited through its value', () => {
  it('changes the value and lays the text out again', () => {
    const edited = editConfigText('{"contexts": {}}', (raw) => {
      raw['importAlias'] = '@';
    });

    expect(JSON.parse(edited)).toEqual({ contexts: {}, importAlias: '@' });
    expect(edited.endsWith('\n')).toBe(true);
  });

  it('leaves a text that holds no object as it is, and never edits it', () => {
    let edited = false;

    expect(
      editConfigText('[]', () => {
        edited = true;
      }),
    ).toBe('[]');

    expect(edited).toBe(false);
  });
});
