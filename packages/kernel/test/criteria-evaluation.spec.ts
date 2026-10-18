import { describe, expect, it } from 'vitest';
import {
  Criteria,
  CriteriaDefinitionError,
  defineCriteria,
  evaluateCriteria,
  offsetPage,
  validateCriteria,
} from '../src/index.js';
import { catalogue, p1, p6, products, type ProductRow } from './support/products.js';

const all = Criteria.of<ProductRow>();

const skus = (criteria: Criteria<ProductRow>): string[] =>
  evaluateCriteria(products, catalogue, criteria.page(offsetPage({ limit: 50 }))).items.map(({ sku }) => sku);

describe('evaluateCriteria, filtering', () => {
  it.each([
    ['a text different from another', all.where('name', 'ne', 'Anvil'), ['p2', 'p3', 'p4', 'p5', 'p6', 'p7']],
    ['a text that contains another', all.where('name', 'contains', 'olt'), ['p3', 'p4']],
    ['a text that starts with another', all.where('name', 'startsWith', 'An'), ['p1', 'p6', 'p7']],
    ['texts after another by code point, capitals first', all.where('name', 'gt', 'Bolt'), ['p2', 'p4', 'p5']],
    ['texts up to another, a prefix coming first', all.where('name', 'lte', 'Ant'), ['p6', 'p7']],
    ['texts after a prefix of theirs', all.where('name', 'gt', 'An'), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']],
    ['decimals above one, compared as numbers', all.where('price', 'gt', '9.5'), ['p1', 'p6']],
    ['decimals from zero, minus zero included', all.where('price', 'gte', '0'), ['p1', 'p2', 'p4', 'p5', 'p6']],
    ['decimals above one of the same whole part', all.where('price', 'gt', '9.25'), ['p1', 'p2', 'p6']],
    ['decimals below one of the same whole part', all.where('price', 'lt', '9.75'), ['p2', 'p3', 'p4', 'p5', 'p7']],
    ['negative decimals below one, trailing zeros aside', all.where('price', 'lt', '-2.250'), ['p7']],
    ['negative decimals up to one', all.where('price', 'lte', '-2.25'), ['p3', 'p7']],
    ['decimals between two', all.where('price', 'between', ['-1', '9.50']), ['p2', 'p4', 'p5']],
    ['decimals in a list, written otherwise', all.where('price', 'in', ['10', '100.000']), ['p1', 'p6']],
    ['decimals equal to zero, however written', all.where('price', 'eq', '0'), ['p4', 'p5']],
    ['numbers above one', all.where('stock', 'gt', 3), ['p3', 'p4', 'p7']],
    ['numbers up to one', all.where('stock', 'lte', 1), ['p2', 'p6']],
    ['a boolean equal to one', all.where('active', 'eq', false), ['p2', 'p4', 'p7']],
    ['a boolean different from one', all.where('active', 'ne', true), ['p2', 'p4', 'p7']],
    ['a value equal to one, never a null', all.where('featured', 'eq', true), ['p1', 'p4']],
    ['the fields that hold a value', all.where('shelf', 'isNull', false), ['p1', 'p3', 'p5', 'p6', 'p7']],
    ['instants before one', all.where('restockedAt', 'lt', new Date('2026-09-20T00:00:00Z')), ['p3', 'p6', 'p7']],
  ])('keeps %s', (_label, criteria, expected) => {
    expect(skus(criteria)).toEqual(expected);
  });

  it.each([
    [
      'keeps the nulls of the opposite of a comparison',
      all.not((none) => none.where('shelf', 'eq', 'A')),
      ['p2', 'p3', 'p4', 'p6', 'p7'],
    ],
    [
      'reads the opposite of isNull as isNull of the other value',
      all.not((none) => none.where('shelf', 'isNull', true)),
      ['p1', 'p3', 'p5', 'p6', 'p7'],
    ],
    [
      'turns the opposite of an or into an and of opposites',
      all.not((none) => none.or((any) => any.where('active', 'eq', true).where('stock', 'gt', 5))),
      ['p2', 'p7'],
    ],
    [
      'keeps a row that one condition of an or holds for',
      all.or((any) => any.where('price', 'lt', '0').where('shelf', 'eq', 'C')),
      ['p3', 'p6', 'p7'],
    ],
    [
      'keeps a row that every condition of an and holds for',
      all.and((every) => every.where('active', 'eq', true).where('stock', 'gt', 2)),
      ['p1', 'p3', 'p5'],
    ],
  ])('%s', (_label, criteria, expected) => {
    expect(skus(criteria)).toEqual(expected);
  });
});

describe('evaluateCriteria, ordering', () => {
  it.each([
    ['texts by code point', all.orderBy('name'), ['p7', 'p6', 'p1', 'p3', 'p5', 'p2', 'p4']],
    ['decimals as numbers', all.orderBy('price'), ['p7', 'p3', 'p4', 'p5', 'p2', 'p1', 'p6']],
    ['booleans, false first', all.orderBy('active'), ['p2', 'p4', 'p7', 'p1', 'p3', 'p5', 'p6']],
    ['booleans, true first', all.orderBy('active', 'desc'), ['p6', 'p5', 'p3', 'p1', 'p7', 'p4', 'p2']],
    ['a field that may be null, nulls last', all.orderBy('shelf'), ['p1', 'p5', 'p3', 'p7', 'p6', 'p2', 'p4']],
    ['a field that may be null, nulls first', all.orderBy('shelf', 'desc'), ['p4', 'p2', 'p6', 'p7', 'p3', 'p5', 'p1']],
    ['a boolean that may be null', all.orderBy('featured'), ['p3', 'p6', 'p1', 'p4', 'p2', 'p5', 'p7']],
    [
      'instants that may be null, latest first',
      all.orderBy('restockedAt', 'desc'),
      ['p5', 'p2', 'p4', 'p1', 'p7', 'p3', 'p6'],
    ],
    ['the tie-breaker alone, as asked', all.orderBy('sku', 'desc'), ['p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1']],
    [
      'one field, then the next where it ties',
      all.orderBy('stock').orderBy('price', 'desc'),
      ['p2', 'p6', 'p1', 'p5', 'p7', 'p4', 'p3'],
    ],
  ])('orders %s', (_label, criteria, expected) => {
    expect(skus(criteria)).toEqual(expected);
  });
});

describe('validateCriteria of decimals and booleans', () => {
  it('refuses a decimal not written as one, and accepts a negative one with a fraction', () => {
    const codes = (criteria: Criteria<ProductRow>): string[] =>
      validateCriteria(products, criteria).map(({ path, code }) => `${path}: ${code}`);

    expect(codes(all.where('price', 'eq', '1e3'))).toEqual(['filter.price: invalid_value']);
    expect(codes(all.where('price', 'eq', '.5'))).toEqual(['filter.price: invalid_value']);
    expect(codes(all.where('price', 'eq', '-0.5'))).toEqual([]);
  });

  it('refuses a boolean that is not one', () => {
    const forged = Criteria.from<ProductRow>({
      filters: [{ kind: 'condition', field: 'active', operator: 'eq', value: 'yes' }],
      sort: [],
    });

    expect(validateCriteria(products, forged).map(({ code }) => code)).toEqual(['invalid_value']);
  });
});

describe('Criteria.from', () => {
  it('reads a criteria written as nothing but a page, ordered as the page asks', () => {
    const criteria = Criteria.from<ProductRow>({
      page: offsetPage({ limit: 2, sort: [{ field: 'price', direction: 'desc' }] }),
    });

    expect(criteria.filters).toEqual([]);
    expect(criteria.sort).toEqual([{ field: 'price', direction: 'desc' }]);

    expect(evaluateCriteria(products, catalogue, criteria)).toEqual({
      items: [p6, p1],
      total: 7,
    });
  });
});

describe('defineCriteria of a field written as data', () => {
  it('refuses a field without a rule', () => {
    const declare = (): unknown =>
      // @ts-expect-error -- a field has a rule
      defineCriteria<ProductRow>({ fields: { sku: { type: 'string' }, name: null }, tieBreaker: 'sku' });

    expect(declare).toThrow(CriteriaDefinitionError);
    expect(declare).toThrow('The field "name" of a criteria definition has no rule.');
  });

  it('refuses a rule that names no type', () => {
    const declare = (): unknown =>
      // @ts-expect-error -- a rule names its type
      defineCriteria<ProductRow>({ fields: { sku: { type: 'string' }, name: { sortable: true } }, tieBreaker: 'sku' });

    expect(declare).toThrow('The field "name" of a criteria definition has a type that is none of');
  });

  it('refuses a type it does not know', () => {
    const declare = (): unknown =>
      // @ts-expect-error -- money is not a field type
      defineCriteria<ProductRow>({ fields: { sku: { type: 'string' }, price: { type: 'money' } }, tieBreaker: 'sku' });

    expect(declare).toThrow('has a type that is none of string, number, boolean, instant, decimal');
  });
});
