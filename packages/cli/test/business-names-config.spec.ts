import { describe, expect, it } from 'vitest';
import { genericWordsOf } from '../src/check/business-names/generic-words-of.js';
import { GENERIC_WORDS } from '../src/check/business-names/generic-words.js';
import { parseConfig, serializeConfig } from '../src/config/index.js';

describe('the generic words of naming/business-name in the config', () => {
  it('are the defaults of the rule when the config does not say, and are not written back', () => {
    const config = parseConfig({});

    expect([...genericWordsOf(config)]).toEqual(GENERIC_WORDS);
    expect(JSON.parse(serializeConfig(config))).not.toHaveProperty('businessNames');
  });

  it('are replaced by "words", less what "allow" removes, and written back as given', () => {
    const config = parseConfig({ businessNames: { words: ['data', 'record', 7, ''], allow: ['data', null] } });

    expect([...genericWordsOf(config)]).toEqual(['record']);

    expect(JSON.parse(serializeConfig(config))).toMatchObject({
      businessNames: { words: ['data', 'record'], allow: ['data'] },
    });
  });

  it('keep the defaults when "words" is not a list, and write back an "allow" alone', () => {
    const config = parseConfig({ businessNames: { words: 'target', allow: ['info'] } });

    expect(genericWordsOf(config).has('info')).toBe(false);
    expect(genericWordsOf(config).has('target')).toBe(true);
    expect(JSON.parse(serializeConfig(config))).toMatchObject({ businessNames: { allow: ['info'] } });
    expect(JSON.parse(serializeConfig(config)).businessNames).not.toHaveProperty('words');
  });
});
