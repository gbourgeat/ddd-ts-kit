import { describe, expect, it } from 'vitest';
import { ignoringCase } from '../src/query/ignoring-case';

describe('ignoringCase', () => {
  it('names both forms of each letter, beyond ASCII too', () => {
    expect(ignoringCase('Élan')).toBe('[Éé][lL][aA][nN]');
    expect(ignoringCase('ñ')).toBe('[ñÑ]');
  });

  it('leaves alone what has one form: a digit, a space, a letter without case', () => {
    expect(ignoringCase('42 日')).toBe('42 日');
  });

  it('escapes what a regular expression of Lucene would read as an operator', () => {
    expect(ignoringCase('.?+*|{}[]()"\\#@&<>~')).toBe('\\.\\?\\+\\*\\|\\{\\}\\[\\]\\(\\)\\"\\\\\\#\\@\\&\\<\\>\\~');
    expect(ignoringCase('100% _-:,')).toBe('100% _-:,');
  });

  it('leaves out a form longer than one character: a sharp s finds itself only', () => {
    expect(ignoringCase('ß')).toBe('ß');
    expect(ignoringCase('İ')).toBe('İ');
  });

  it('reads a letter outside the basic plane as one character', () => {
    expect(ignoringCase('𐐨')).toBe('[𐐨𐐀]');
  });
});
