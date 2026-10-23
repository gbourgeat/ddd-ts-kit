import type { TenantResolver } from './tenant-resolver';

/**
 * The label left of the base domain: with `app.example.com`, `acme.app.example.com` is the tenant
 * `acme`. The base domain itself, another domain and a deeper subdomain name none. It reads the
 * `Host` header: behind a proxy, have it pass the original host.
 */
export function tenantFromSubdomain(baseDomain: string): TenantResolver {
  const suffix = `.${baseDomain.toLowerCase()}`;

  return ({ headers }) => {
    const host = typeof headers['host'] === 'string' ? headers['host'].toLowerCase().replace(/:\d+$/, '') : '';

    if (!host.endsWith(suffix)) {
      return undefined;
    }

    const label = host.slice(0, -suffix.length);

    return label === '' || label.includes('.') ? undefined : label;
  };
}
