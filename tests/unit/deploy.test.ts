import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* The deployed build (docs/deploy.md): an internal tool that is never indexed,
   whose pages are re-checked on every visit while the hashed assets are kept
   for a year, and an .htaccess the IONOS host accepts. */

const ROOT = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const htaccess = read('public/.htaccess');
// The rules alone, without the why-comments (which name the forbidden directives).
const rules = htaccess
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

describe('the pages', () => {
  for (const page of ['index.html', 'render.html']) {
    it(`${page} asks not to be indexed`, () => {
      expect(read(page)).toContain('<meta name="robots" content="noindex, nofollow" />');
    });
  }
});

describe('public/.htaccess', () => {
  it('says noindex on every answer, since robots.txt only counts at the domain root', () => {
    expect(rules).toContain('Header set X-Robots-Tag "noindex, nofollow"');
  });

  it('has browsers re-check the pages on every visit', () => {
    expect(rules).toMatch(/<FilesMatch "\\\.html\$">\s*Header set Cache-Control "no-cache"\s*<\/FilesMatch>/);
  });

  it('keeps the hashed assets for a year', () => {
    expect(rules).toMatch(/<FilesMatch "[^"]+">\s*Header set Cache-Control "public, max-age=31536000, immutable"\s*<\/FilesMatch>/);
  });

  it('sends http to https with the path from the request line (IONOS has MultiViews on)', () => {
    expect(rules).toContain('RewriteCond %{HTTPS} !=on');
    expect(rules).toMatch(/RewriteCond %\{THE_REQUEST\}.*\n\s*RewriteRule \^ https:\/\/%\{HTTP_HOST\}%1 \[R=301,L,NE\]/);
  });

  it('uses no directive the IONOS host refuses (each answers every page with a 403)', () => {
    expect(rules).not.toMatch(/^\s*(Options|php_flag|php_value)\b/m);
    expect(rules).not.toMatch(/<If\b/);
  });
});
