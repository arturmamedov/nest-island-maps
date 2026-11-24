# Putting the island maps on the web

For the owner. You need the computer with the checkout (Laragon's Node), FileZilla and a browser. The app lives at **https://nestpass.ai/nestmaps/** on the IONOS webhosting. It is static files only: no PHP, no database, nothing to set up on the server.

> **Status, 2026-11-24:** live and **public**, as an MVP demo (the owner's choice), and never indexed. Edits stay in each person's browser; saving for everyone comes later.

## 1. Build

On the computer with the checkout:

```sh
npm run build
```

It makes `dist/`: `index.html`, `render.html` (the page the tests screenshot; harmless), the hidden `.htaccess`, and `assets/` (about 1.9 MB in all).

Zip `dist/` as `nestmaps-<date>.zip` and keep it on the office drive. An old zip is how you roll back.

## 2. Upload

1. **In FileZilla, show hidden files:** *Server* → *Force showing hidden files*. `.htaccess` starts with a dot. Without it the site still works, but it can be indexed, stays on `http://`, and browsers may keep an old page after an update.
2. Open the `nestmaps/` folder on the server and upload **the contents of `dist/`**, not the `dist` folder itself, into it. Replace the files when asked.
3. **Don't delete `assets/` first.** A new build's files have new names, so the old ones simply stay beside them. Someone who has the page open during the upload still loads the export code under the old names. You can clear old files out after a few days; nothing breaks either way.

## 3. Check

- In a **private window**, https://nestpass.ai/nestmaps/ shows the editor, and a PNG export downloads.
- http://nestpass.ai/nestmaps/ switches to `https://`.
- The headers show that the `.htaccess` arrived. From the checkout (or ask Claude to run it):

  ```sh
  curl -sI https://nestpass.ai/nestmaps/
  ```

  It should show `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-cache`. An asset such as `assets/main-….js` should show `Cache-Control: public, max-age=31536000, immutable`.

## Why the caching is safe

Every file in `assets/` is named after its content (`main-DkizXxFL.js`), so a new build brings new names, and browsers may keep those files for a year. The pages keep their names, so browsers re-check them on every visit. After an upload, everyone gets the new version on their next visit, with no cache to clear.

## Publishing a data change

The published maps are built into the app. To publish an edit for everyone:

1. In the app, **Download JSON**.
2. Put the file in `data/seed/` under the island's name (`tenerife.json`, `gran_canaria.json`, `ibiza.json`).
3. Commit it, then build and upload as above.

Until then, edits stay in the editor's own browser. After an update, anyone with an older draft sees "the published map changed since this draft was saved", with *Load published* or *Keep draft*.

## Rolling back

Upload the contents of the previous zip the same way.

## What the host refuses in `.htaccess`

IONOS answers **every page with a 403** when `.htaccess` holds an `Options`, `php_flag` or `<If>` line. Only headers, rewrites and `FilesMatch` work there. If the folder suddenly answers 403 after a hand edit, remove the line you added.

## The staff password, later

When the tool should be staff-only, paste the flyers app's password block at the **top** of `.htaccess`, with the same login as the flyers app, so staff use one password for both. The block is in `nest-flyers/php/web/access-examples/htaccess-basic-auth.txt`, minus its three `<If …>` lines, which this host refuses. Every upload replaces `.htaccess`, so paste it again after each one.
