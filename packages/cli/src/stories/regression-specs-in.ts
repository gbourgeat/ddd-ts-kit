import { sectionOf } from './section-of';

/** One item of `## Regression`: `- test/unit/order.aggregate.spec.ts`, with or without backticks. */
const ITEM = /^\s*[-*]\s+`?([^`\s]+)`?/;

/** The spec paths listed under `## Regression` of a fix story; undefined without the section. */
export function regressionSpecsIn(text: string): string[] | undefined {
  const section = sectionOf(text, 'Regression');

  return section
    ?.split('\n')
    .map((line) => ITEM.exec(line)?.[1])
    .filter((item): item is string => item !== undefined);
}
