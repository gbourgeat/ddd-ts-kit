/**
 * How Varnish is asked to purge: `xkey`, a `PURGE` with the `xkey-purge` header, which vmod_xkey
 * turns into a removal of every object filed under one of the tags, at once; `ban`, a `PURGE` per
 * tag with the `x-ban-tag` header, which the VCL turns into a ban on the `xkey` header the
 * objects keep, applied lazily as they are looked up (for a Varnish without vmod_xkey, with its
 * own VCL).
 */
export const VarnishPurgeMode = {
  xkey: 'xkey',
  ban: 'ban',
} as const;

export type VarnishPurgeMode = (typeof VarnishPurgeMode)[keyof typeof VarnishPurgeMode];
