import type { Quote } from '../../../quote.js';

export abstract class Quotes {
  abstract readonly calls: string[];

  abstract quote(pair: string): Promise<Quote>;
}
