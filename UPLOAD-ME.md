# Upload this folder directly to GitHub

This package is already arranged for GitHub Pages.

Upload the CONTENTS of this folder to the root of your repository.

At the repository root you should immediately see:

- index.html
- styles.css
- sw.js
- manifest.webmanifest
- .nojekyll
- src/
- icons/
- canvas-proxy/

Do not upload a parent folder around these files.
Do not upload the ZIP itself.

Then commit to main and wait for the Pages deployment in Actions to turn green.

This build uses network-first caching + cache-busted assets so updates should show much more reliably.
