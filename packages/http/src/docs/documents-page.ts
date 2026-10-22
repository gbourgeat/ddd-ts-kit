import type { DocsUi } from './docs-ui';
import { escapeHtml } from './escape-html';

/** One document of a split contract, as the documentation page lists it. */
export interface ListedDocument {
  readonly name: string;
  readonly title: string;
  /** Where its JSON is served. */
  readonly url: string;
  /** Where its own page is served. */
  readonly page: string;
}

interface DocumentsPage {
  readonly ui: DocsUi;
  readonly title: string;
  readonly documents: readonly ListedDocument[];
  readonly assets: string;
}

/**
 * The page of a contract split into documents: Swagger UI with its selector between them; for
 * the other pages, which show one document at a time, the list of the page of each document.
 */
export function documentsPage({ ui, title, documents, assets }: DocumentsPage): string {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>`;

  if (ui !== 'swagger') {
    const links = documents.map(
      (document) => `<li><a href="${escapeHtml(document.page)}">${escapeHtml(document.title)}</a></li>`,
    );

    return `${head}</head><body><h1>${escapeHtml(title)}</h1><ul>${links.join('')}</ul></body></html>`;
  }

  const base = escapeHtml(assets);
  const urls = JSON.stringify(documents.map(({ url, title: name }) => ({ url, name }))).replaceAll('<', '\\u003c');

  return `${head}<link rel="stylesheet" href="${base}/swagger-ui.css"></head><body><div id="ui"></div><script src="${base}/swagger-ui-bundle.js"></script><script src="${base}/swagger-ui-standalone-preset.js"></script><script>SwaggerUIBundle({ urls: ${urls}, dom_id: '#ui', presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], layout: 'StandaloneLayout' });</script></body></html>`;
}
