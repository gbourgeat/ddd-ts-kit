const OPENERS = '(<{[';
const CLOSERS = ')>}]';

/**
 * How many parameters the signature at the head of `factory` declares (`static create(id: string,
 * now: Date)` declares two), a comma inside a type (`Pick<State, 'a' | 'b'>`) counting for none.
 */
export function parameterCount(factory: string): number {
  const parameters: string[] = [''];
  let depth = 0;

  for (let index = factory.indexOf('(') + 1; index < factory.length; index += 1) {
    const character = factory.charAt(index);

    depth += depthChange(character, factory.charAt(index - 1));

    if (depth < 0) {
      break;
    }

    if (depth === 0 && character === ',') {
      parameters.push('');
    } else {
      parameters[parameters.length - 1] += character;
    }
  }

  return parameters.filter((parameter) => parameter.trim() !== '').length;
}

/** `=>` of a function type closes nothing. */
function depthChange(character: string, previous: string): number {
  if (OPENERS.includes(character)) {
    return 1;
  }

  return CLOSERS.includes(character) && !(character === '>' && previous === '=') ? -1 : 0;
}
