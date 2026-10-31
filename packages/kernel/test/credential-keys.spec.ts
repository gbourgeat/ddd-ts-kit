import { describe, expect, it } from 'vitest';
import { CREDENTIAL_KEYS, isCredentialKey } from '../src';

describe('isCredentialKey', () => {
  it('names every key of CREDENTIAL_KEYS, whatever its case', () => {
    for (const key of CREDENTIAL_KEYS) {
      expect([key, key.toUpperCase(), key.toLowerCase()].map(isCredentialKey)).toEqual([true, true, true]);
    }

    expect(
      ['Authorization', 'X-Api-Key', 'ClientSecret', 'ID_TOKEN', 'PrivateKey', 'Passwd'].map(isCredentialKey),
    ).toEqual([true, true, true, true, true, true]);
  });

  it('holds the spellings a client, a header or a key file uses', () => {
    expect(CREDENTIAL_KEYS).toEqual(
      expect.arrayContaining([
        'clientSecret',
        'client-secret',
        'x-api-key',
        'id_token',
        'idToken',
        'private_key',
        'privateKey',
        'passwd',
      ]),
    );
  });

  it('leaves any other name alone', () => {
    expect(['userId', 'email', 'tokenCount', 'secretary', ''].map(isCredentialKey)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
