import type { Config } from '../config';
import { CliError } from '../cli-error';
import { replaceRegion } from '../markers';
import { readTemplate } from '../templating';
import type { Workspace } from '../workspace';
import type { ContextFacts } from './context-facts';
import { privacyRegisterLines } from './privacy-register-lines';

const REGISTER = 'docs/privacy/register.md';

/**
 * Writes the generated part of the register of personal data, in a project whose platform answers
 * the requests of a data subject (`stack.privacy: "on"`); the rest of the file is the team's.
 */
export function writePrivacyRegister(ws: Workspace, config: Config, contexts: readonly ContextFacts[]): void {
  if (config.stack.privacy !== 'on') {
    return;
  }

  const existing = ws.read(REGISTER);

  const next = replaceRegion(
    existing ?? readTemplate('docs/privacy-register.md.tpl'),
    'personal-data-register',
    privacyRegisterLines(contexts),
  );

  if (next === undefined) {
    throw new CliError(
      `${REGISTER} has no "ddd-ts-kit:personal-data-register" markers.`,
      'Put back `<!-- ddd-ts-kit:personal-data-register -->` and `<!-- /ddd-ts-kit:personal-data-register -->` where the generated tables belong; the text around them is yours.',
    );
  }

  if (existing === undefined) {
    ws.create(REGISTER, next);
  } else {
    ws.update(REGISTER, next);
  }
}
