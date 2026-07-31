# Ultimate DFS Generator — iPhone PWA

This package is the installable-web-app version of Ultimate DFS Generator V5.

Files:
- index.html
- manifest.webmanifest
- service-worker.js
- icon.svg

## Important
A PWA must be served over HTTPS (or localhost). Do not open index.html from the iPhone Files preview.

## Easy hosting
Upload all four files to a static HTTPS host such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel.

## iPhone install
1. Open the hosted HTTPS URL in Safari.
2. Tap Safari's Share button.
3. Tap Add to Home Screen.
4. Confirm the name and tap Add.
5. Launch Ultimate DFS from the new Home Screen icon.

The service worker caches the app shell after the first successful visit. Online NFL/DraftKings-related data still requires an internet connection when it is fetched.
