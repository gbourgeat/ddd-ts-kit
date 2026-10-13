import { describe, expect, it } from 'vitest';
import { searchedElements } from '../src/generate/searched-elements.js';
import { plural, singular, toName } from '../src/naming/index.js';

describe('the names a generated search gives to its lines', () => {
  it('are the business words of the search, never item and items', () => {
    expect(searchedElements(toName('SearchInvoices'))).toEqual({ element: 'invoice', elements: 'invoices' });

    expect(searchedElements(toName('SearchPurchaseOrders'))).toEqual({
      element: 'purchaseOrder',
      elements: 'purchaseOrders',
    });

    expect(searchedElements(toName('SearchDeliveries'))).toEqual({ element: 'delivery', elements: 'deliveries' });
  });

  it('read a search named after a singular as one element and its plural', () => {
    expect(searchedElements(toName('SearchOccupancy'))).toEqual({ element: 'occupancy', elements: 'occupancies' });
    expect(searchedElements(toName('Agenda'))).toEqual({ element: 'agenda', elements: 'agendas' });
  });

  it('are prefixed when the template already uses the word, or the language reserves it', () => {
    expect(searchedElements(toName('SearchPages'))).toEqual({ element: 'foundPage', elements: 'foundPages' });
    expect(searchedElements(toName('SearchNews'))).toEqual({ element: 'foundNew', elements: 'foundNews' });
  });
});

describe('plural and singular', () => {
  it('turn an English noun into the other form', () => {
    expect(['reminder', 'delivery', 'box', 'batch', 'day'].map(plural)).toEqual([
      'reminders',
      'deliveries',
      'boxes',
      'batches',
      'days',
    ]);

    expect(['reminders', 'deliveries', 'boxes', 'batches', 'days'].map(singular)).toEqual([
      'reminder',
      'delivery',
      'box',
      'batch',
      'day',
    ]);
  });

  it('say nothing of a word that is not a plural', () => {
    expect(['data', 'status', 'stuff', 'menu'].map(singular)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
