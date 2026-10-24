import { LINE_WIDTH } from '../../../layout';

/** The first line of the adapter class: on one line while it fits, each heritage clause on its own line beyond, as the formatter lays it out. */
export function classHeader(adapter: string, base: string, port: string): string {
  const oneLine = `export class ${adapter} extends ${base} implements ${port} {`;

  return oneLine.length <= LINE_WIDTH ? oneLine : `export class ${adapter}\n  extends ${base}\n  implements ${port}\n{`;
}
