import { sectionOf } from '../stories/section-of';

/** A list item naming a spec file: `- test/unit/order.aggregate.spec.ts`, with or without backticks. */
const ITEM = /^\s*[-*]\s+`?([^\s`]+)`?/;

/**
 * The spec files the `## Regression` section of a story file lists, one list item each, relative
 * to the project root: the proof of a fix, written before its code. Undefined without the
 * section: the story is not a fix.
 */
export function regressionFilesIn(text: string): string[] | undefined {
  const section = sectionOf(text, 'Regression');

  if (section === undefined) {
    return undefined;
  }

  const files = section.split('\n').flatMap((line) => {
    const [, file] = ITEM.exec(line) ?? [];

    return file === undefined ? [] : [file.replace(/^\.\//, '')];
  });

  return [...new Set(files)];
}
