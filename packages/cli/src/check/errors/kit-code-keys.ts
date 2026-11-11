import { toName } from '../../naming';
import { KIT_ERROR_CODES } from './kit-error-codes';

/** The codes of the kit by the key `KitCodes` of `@ddd-ts-kit/kernel` gives each: `Forbidden` names `FORBIDDEN`. */
export const KIT_CODE_KEYS: ReadonlyMap<string, string> = new Map(
  KIT_ERROR_CODES.map((code) => [toName(code).pascal, code]),
);
