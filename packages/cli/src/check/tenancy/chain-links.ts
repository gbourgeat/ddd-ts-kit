import { balancedArguments } from './balanced-arguments';

/** One link of a chain: `.where({ id })`, or `.or`, a property that takes no arguments. */
export interface ChainLink {
  readonly method: string;
  /** Where the link starts in the code, at its dot. */
  readonly offset: number;
  /** Where the text between its parentheses starts. */
  readonly argumentsAt: number;
  /** The text between its parentheses: empty for a property. */
  readonly argumentsText: string;
}

/**
 * The links of the chain that goes on at `from`, what a callback holds left out: a link of a chain
 * inside an argument is no link of this one. `.where(a).orderBy(b)`, across lines, with type
 * arguments, stopping at the first thing that is no link.
 */
export function chainLinks(code: string, from: number): readonly ChainLink[] {
  const link = /\s*\??\.\s*([A-Za-z_$][\w$]*)\s*(?:<[^()]*>\s*)?(\(?)/y;
  const links: ChainLink[] = [];
  let index = from;

  for (let found = matchAt(link, code, index); found !== null; found = matchAt(link, code, index)) {
    const [whole, method = '', open = ''] = found;
    const argumentsAt = index + whole.length;
    const argumentsText = open === '' ? '' : balancedArguments(code, argumentsAt - 1);

    links.push({ method, offset: index, argumentsAt, argumentsText });
    index = open === '' ? argumentsAt : argumentsAt + argumentsText.length + 1;
  }

  return links;
}

function matchAt(sticky: RegExp, code: string, index: number): RegExpExecArray | null {
  sticky.lastIndex = index;

  return sticky.exec(code);
}
