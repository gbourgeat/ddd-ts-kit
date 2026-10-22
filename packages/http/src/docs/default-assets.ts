import type { DocsUi } from './docs-ui';

/** Where each documentation page loads its UI from by default: a public CDN, pinned to a major version. */
export const DEFAULT_ASSETS: Readonly<Record<DocsUi, string>> = {
  swagger: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5',
  scalar: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1',
  redoc: 'https://cdn.jsdelivr.net/npm/redoc@2/bundles',
};
