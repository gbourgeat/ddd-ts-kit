import type { DocsUi } from './docs-ui.js';

interface DocsPage {
  readonly ui: DocsUi;
  readonly title: string;
  readonly specUrl: string;
  readonly assets: string;
}

/** The HTML page that loads the chosen UI and points it at the contract. */
export function docsPage({ ui, title, specUrl, assets }: DocsPage): string {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>`;
  const spec = escapeHtml(specUrl);
  const base = escapeHtml(assets);

  switch (ui) {
    case 'swagger':
      return `${head}<link rel="stylesheet" href="${base}/swagger-ui.css"></head><body><div id="ui"></div><script src="${base}/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: '#ui' });</script></body></html>`;
    case 'scalar':
      return `${head}</head><body><script id="api-reference" data-url="${spec}"></script><script src="${base}"></script></body></html>`;
    case 'redoc':
      return `${head}</head><body><redoc spec-url="${spec}"></redoc><script src="${base}/redoc.standalone.js"></script></body></html>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
