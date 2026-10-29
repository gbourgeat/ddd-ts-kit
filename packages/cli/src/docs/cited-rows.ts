import { CRITERION, ROW } from '../acceptance/scenarios-in';

/** The ids a title may open with: a row (`#US1.04`, `#FIX1`) and a criterion (`AC1`), as `acceptance` reads them. */
const LEADING_IDS = new RegExp(`^(?:\\s*(?:${ROW.source}|${CRITERION.source})[\\s,:;-]*)+`);

/** A title split into the rows and criteria it opens with, as `test/title-states-a-rule` asks them written, and the rule. */
export interface CitedRows {
  /** `#US5.02 AC1`, as written, without the punctuation that ends it; empty when the title cites none. */
  readonly prefix: string;
  /** `US5.02`: the rows of the plan the title cites, without their `#`. */
  readonly rows: readonly string[];
  /** The rule, in the words of the business: the whole title when it is nothing but ids. */
  readonly text: string;
}

export function citedRows(title: string): CitedRows {
  const leading = LEADING_IDS.exec(title)?.[0] ?? '';
  const text = title.slice(leading.length).trim();

  return {
    prefix: leading.replace(/[\s,:;-]+$/, '').trim(),
    rows: [...leading.matchAll(ROW)].flatMap(([, id]) => (id === undefined ? [] : [id])),
    text: text === '' ? title : text,
  };
}
