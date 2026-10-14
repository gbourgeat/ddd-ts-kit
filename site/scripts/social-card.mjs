#!/usr/bin/env node
/**
 * Renders the card a shared link to the site shows, site/src/assets/social-card.svg, to
 * site/public/social-card.png (1200 x 630, the size Open Graph and X expect). The PNG is committed:
 * the text is drawn with the fonts of the machine, so run it again after changing the SVG and look
 * at the result before committing it.
 *
 *   node site/scripts/social-card.mjs
 */
import path from 'node:path';
import sharp from 'sharp';

const SITE_ROOT = path.resolve(import.meta.dirname, '..');

await sharp(path.join(SITE_ROOT, 'src/assets/social-card.svg'))
  .png({ compressionLevel: 9 })
  .toFile(path.join(SITE_ROOT, 'public/social-card.png'));
