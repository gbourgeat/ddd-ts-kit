import type { CacheCodec } from './cache-codec.js';

/** The default: what goes in must be JSON, and a `Date` comes back as a string. */
export const jsonCodec: CacheCodec = {
  encode: (value) => JSON.stringify(value),
  decode: (text) => {
    const value: unknown = JSON.parse(text);

    return value;
  },
};
