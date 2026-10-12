import type { LegacyError } from './legacy-error.js';
import type { Move } from './move.js';

/** A type a fact may have: plain data, as `RefusalFact` of the kernel says. */
const FACT_TYPE = /^(?:readonly\s+)?(?:string|number|boolean|Date)(?:\[\])?$/;

/** The static factory that replaces the constructor of a class per error: same parameters, same message, its plain parameters as facts. */
export function renderFactory(error: LegacyError, move: Move): string {
  const parameters = error.parameters.map(({ name, type }) => `${name}: ${type}`).join(', ');
  const facts = error.parameters.filter(({ type }) => FACT_TYPE.test(type)).map(({ name }) => name);
  const given = facts.length === 0 ? '' : `, { ${facts.join(', ')} }`;

  return [
    `  static ${move.factory}(${parameters}) {`,
    `    return ${move.conceptClass}.refusal('${move.code}', ${error.message}${given});`,
    '  }',
  ].join('\n');
}
