import type { ContentRules, TextRule } from '@ddd-ts-kit/kernel';

/**
 * The file a route receives, in a `multipart/form-data` request: the field that carries it, the
 * most it may weigh and the media types it may be. All of it is part of the contract (the OpenAPI
 * document states it) and is enforced while the content streams.
 */
export interface UploadSpec {
  readonly field: string;
  readonly maxBytes: number;
  /**
   * Exact types or families (`image/*`), verified on the first bytes of the content, never on the
   * file name. Each must have a content rule: a signature or the text rule of the kit, or the one
   * `contentRules` states. A type with none could receive no file, and is refused when the route
   * is declared.
   */
  readonly mediaTypes: readonly string[];
  /**
   * The text a text type may be: `utf-8` (the default) or `single-byte`, which also takes an export
   * in Windows-1252 or ISO-8859-1. The handler receives the bytes as they came and decodes them
   * itself (`isUtf8` of the kernel tells which it holds); a binary file is refused under both.
   */
  readonly text?: TextRule;
  /**
   * The rule of each accepted type the kit has none for: `{ 'application/vnd.ms-excel': 'text' }`
   * for the CSV a browser on Windows sends, `{ 'application/octet-stream': 'unchecked' }` for bytes
   * the route takes as they are.
   */
  readonly contentRules?: ContentRules;
}
