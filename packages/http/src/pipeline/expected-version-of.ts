import { PreconditionFailedError } from '@ddd-ts-kit/kernel';
import { IfMatch } from '../cache/if-match.js';
import { PreconditionRequiredError } from '../error/precondition-required-error.js';
import type { RawHeaders } from '../route/raw-headers.js';
import type { Route } from '../route/route.js';
import { headerText } from '../support/header-text.js';

const ANY = '*';
const VERSION_TAG = /^(?:W\/)?"(\d{1,15})"$/;

/**
 * The version a conditional write was made on, read from `If-Match` as the kit writes it: the
 * weak tag of a version, `W/"7"`, or its strong form `"7"`. RFC 9110 compares `If-Match` strongly,
 * which never matches a weak tag; the kit compares versions instead, which is what both forms
 * name. Nothing when the route declares no `ifMatch`, the caller sent none or sent `*`.
 */
export function expectedVersionOf(route: Pick<Route, 'ifMatch'>, headers: Readonly<RawHeaders>): number | undefined {
  if (route.ifMatch === undefined) {
    return undefined;
  }

  const written = headerText(headers['if-match'])?.trim() ?? '';

  if (written === '') {
    if (route.ifMatch === IfMatch.required) {
      throw new PreconditionRequiredError('This change requires If-Match: the ETag of the version it was made on.');
    }

    return undefined;
  }

  if (written === ANY) {
    return undefined;
  }

  const [, version] = VERSION_TAG.exec(written) ?? [];

  if (version === undefined) {
    throw new PreconditionFailedError('If-Match names no version of this resource.');
  }

  return Number(version);
}
