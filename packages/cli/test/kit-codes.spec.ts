import { KitCodes } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { KIT_CODE_KEYS } from '../src/check/errors/kit-code-keys';
import { KIT_CODES_LIST } from '../src/check/errors/kit-codes-list';
import { KIT_ERROR_CODES } from '../src/check/errors/kit-error-codes';

describe('the codes of the kit, as the checker knows them and as the kernel exports them', () => {
  it('lists the same codes, in the same order', () => {
    expect(Object.values(KitCodes)).toEqual(KIT_ERROR_CODES);
  });

  it('reads `KitCodes.<Key>` in a route as the code the kernel gives that key', () => {
    expect(KIT_CODES_LIST).toBe('KitCodes');
    expect(Object.fromEntries(KIT_CODE_KEYS)).toEqual(KitCodes);
  });
});
