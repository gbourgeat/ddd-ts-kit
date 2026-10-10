import { isOneOf, RELATIONSHIPS, type Upstream } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import { parseContextName } from '../../naming/index.js';
import type { Kind } from '../kind.js';
import { parseTerms } from '../parse-terms.js';
import { generateContext } from './generate-context.js';

export const contextKind: Kind = {
  name: 'context',
  aliases: [],
  usage: 'context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]...',
  summary: 'A bounded context: CONTEXT.md with its glossary, published language, config entry, and what assembles it (its declarations, or its module file).',
  positionals: ['name'],
  writesShared: true,
  run: ({ ws, config, args, flags }) => {
    generateContext(ws, config, {
      name: args[0] ?? '',
      classification: flags.classification,
      upstreams: flags.upstream.map(parseUpstreamFlag),
      purpose: flags.purpose,
      terms: parseTerms(flags.term),
    });
  },
};

function parseUpstreamFlag(value: string): Upstream {
  const [context = '', relationship = 'published-language'] = value.split(':');

  if (!isOneOf(RELATIONSHIPS, relationship)) {
    throw new CliError(`Unknown relationship "${relationship}" in --upstream ${value}.`, `Use one of: ${RELATIONSHIPS.join(', ')}.`);
  }

  return { context: parseContextName(context).kebab, relationship };
}
