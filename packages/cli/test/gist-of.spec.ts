import { describe, expect, it } from 'vitest';
import { gistOf } from '../src/workspace/gist-of';

describe('the gist of a marker', () => {
  it('is its text up to its first colon, semicolon or end of sentence', () => {
    expect(gistOf('decide what "issue invoice" does to an Invoice: either it gives birth to one')).toBe(
      'decide what "issue invoice" does to an Invoice',
    );

    expect(gistOf('narrow what is read to what the asker may see; a query never changes state')).toBe(
      'narrow what is read to what the asker may see',
    );

    expect(gistOf('state the decision. Then say why.')).toBe('state the decision');
  });

  it('reads past a colon or a period inside code', () => {
    expect(gistOf('one transition per intention, `issue: { from: [draft] }`: a guard refuses the rest')).toBe(
      'one transition per intention, `issue: { from: [draft] }`',
    );

    expect(gistOf('see docs/concepts/event-sourcing.md of the kit')).toBe(
      'see docs/concepts/event-sourcing.md of the kit',
    );
  });

  it('cuts a long one at its first comma past six words, outside parentheses', () => {
    expect(
      gistOf('add the criteria as primitives (a filter, a period), then the handler hands them over to the reader'),
    ).toBe('add the criteria as primitives (a filter, a period)...');
  });

  it('cuts a long one without a comma after twelve words', () => {
    expect(gistOf('replace each entry below by a test named after the business behaviour of the use case')).toBe(
      'replace each entry below by a test named after the business behaviour...',
    );
  });

  it('cuts before a parenthesis left open by the twelfth word', () => {
    expect(gistOf('add one ingredient per fact a test may need to choose (a date, an amount) and nothing else')).toBe(
      'add one ingredient per fact a test may need to choose...',
    );
  });
});
