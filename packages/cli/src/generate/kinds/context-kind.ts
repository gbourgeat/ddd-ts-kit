import { isOneOf, RELATIONSHIPS, type Upstream } from '../../config';
import { CliError } from '../../cli-error';
import { parseContextName } from '../../naming';
import type { Kind } from '../kind';
import { parseTerms } from '../parse-terms';
import { applyPreset } from '../../presets/apply-preset';
import { presetNamed } from '../../presets/preset-named';
import { generateContext } from './generate-context';

export const contextKind: Kind = {
  name: 'context',
  aliases: [],
  usage:
    'context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]... [--preset identity]',
  summary:
    'A bounded context: CONTEXT.md with its glossary, published language, config entry, and what assembles it (its declarations, or its module file); with --preset, written whole from a preset of the kit.',
  positionals: ['name'],
  writesShared: true,
  run: ({ ws, config, args, flags }) => {
    const name = args[0] ?? '';
    const preset = flags.preset === undefined ? undefined : presetNamed(flags.preset);

    const declared = generateContext(ws, config, {
      name,
      classification: flags.classification ?? preset?.classification,
      upstreams: flags.upstream.map(parseUpstreamFlag),
      purpose: flags.purpose ?? preset?.purpose,
      terms: parseTerms(flags.term),
    });

    if (preset !== undefined) {
      applyPreset(ws, declared, { context: name, preset });
    }
  },
};

function parseUpstreamFlag(value: string): Upstream {
  const [context = '', relationship = 'published-language'] = value.split(':');

  if (!isOneOf(RELATIONSHIPS, relationship)) {
    throw new CliError(
      `Unknown relationship "${relationship}" in --upstream ${value}.`,
      `Use one of: ${RELATIONSHIPS.join(', ')}.`,
    );
  }

  return { context: parseContextName(context).kebab, relationship };
}
