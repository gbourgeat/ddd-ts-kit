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

  it('goes back before a parenthesis its clause leaves open, and marks the cut', () => {
    expect(gistOf('name the permission of the use case as its @Requires does (requires: billing.invoice.issue)')).toBe(
      'name the permission of the use case as its @Requires does...',
    );
  });

  it('goes back before a parenthesis opened early, keeping at least the first word', () => {
    expect(gistOf('one two (three four five six seven eight nine ten eleven twelve thirteen) fourteen')).toBe(
      'one two...',
    );

    expect(gistOf('(one two three four five six seven eight nine ten eleven twelve thirteen) fourteen')).toBe(
      '(one...',
    );
  });

  it.each([
    ['see e.g. the invoice of the customer', 'see e.g. the invoice of the customer'],
    ['say what it is, i.e. the rule it holds', 'say what it is, i.e. the rule it holds'],
    ['the lines, the columns, etc. of the table', 'the lines, the columns, etc. of the table'],
    ['a refusal vs. a failure of the store', 'a refusal vs. a failure of the store'],
    ['follow option b. of the plan', 'follow option b. of the plan'],
  ])('does not end its clause on an abbreviation or a one-letter segment: %s', (text, gist) => {
    expect(gistOf(text)).toBe(gist);
  });
});
