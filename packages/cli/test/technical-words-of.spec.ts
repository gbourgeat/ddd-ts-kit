import { describe, expect, it } from 'vitest';
import { parseGlossary, type Glossary } from '../src/check/language/parse-glossary';
import { technicalWordsOf } from '../src/check/language/technical-words-of';

describe('the technical words of a name, the glossary heard', () => {
  it.each(['InvoiceManager', 'PriceHelper', 'DateUtil', 'StringUtils', 'CustomerData', 'OrderInfo', 'PricingModel'])(
    'finds the technical word of %s when no term holds it',
    (name) => {
      expect(technicalWordsOf(name, glossaryOf('Invoice', 'Price'))).toHaveLength(1);
    },
  );

  it('lets a technical word through when the words around it say a term of the glossary', () => {
    const glossary = glossaryOf('Scoring model', 'Copy of data');

    expect(technicalWordsOf('ScoringModel', glossary)).toEqual([]);
    expect(technicalWordsOf('ScoringModelVersioned', glossary)).toEqual([]);
    expect(technicalWordsOf('ScoringModels', glossary)).toEqual([]);
    expect(technicalWordsOf('CopyOfData', glossary)).toEqual([]);
  });

  it('keeps the technical word a term does not hold where it stands', () => {
    const glossary = glossaryOf('Scoring model', 'Scoring');

    expect(technicalWordsOf('PricingModel', glossary)).toEqual(['model']);
    expect(technicalWordsOf('ScoringData', glossary)).toEqual(['data']);
    expect(technicalWordsOf('ModelScoring', glossary)).toEqual(['model']);
    expect(technicalWordsOf('ScoringModelData', glossary)).toEqual(['data']);
  });
});

function glossaryOf(...terms: string[]): Glossary {
  const rows = terms.map((term) => `| ${term} | What it means. |`);

  return parseGlossary(['## Ubiquitous language', '', '| Term | Meaning |', '|---|---|', ...rows].join('\n'));
}
