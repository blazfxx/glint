// Draws Glint's icons from the SVGs below: the app icon (build/icon.png, 1024 px) and the tray
// icons (assets/). Needs Playwright with a Chromium:
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs CHROME=/path/to/chrome node scripts/make-icons.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const here = path.join(import.meta.dirname, '..');

// A sparkle inside the corners of a viewfinder, on a violet-to-pink tile.
const APP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
  <linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff"/><stop offset="0.55" stop-color="#6a4cf2"/><stop offset="1" stop-color="#e2459a"/></linearGradient>
  <radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="64" height="64" rx="15" fill="url(#t)"/>
<g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
  <path d="M13 22v-6a3 3 0 0 1 3-3h6"/><path d="M42 13h6a3 3 0 0 1 3 3v6"/><path d="M51 42v6a3 3 0 0 1-3 3h-6"/><path d="M22 51h-6a3 3 0 0 1-3-3v-6"/>
</g>
<circle cx="32" cy="32" r="15" fill="url(#g)"/>
<path d="M32 18.5c1.2 7.1 6.4 12.3 13.5 13.5-7.1 1.2-12.3 6.4-13.5 13.5-1.2-7.1-6.4-12.3-13.5-13.5 7.1-1.2 12.3-6.4 13.5-13.5Z" fill="#fff"/>
<circle cx="42.5" cy="21.5" r="2.1" fill="#fff" opacity="0.9"/>
</svg>`;

// The tray: the same mark in one colour. macOS tints template images for light and dark menus.
const TRAY = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<g fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 10V6.5A2.5 2.5 0 0 1 6.5 4H10"/><path d="M22 4h3.5A2.5 2.5 0 0 1 28 6.5V10"/><path d="M28 22v3.5a2.5 2.5 0 0 1-2.5 2.5H22"/><path d="M10 28H6.5A2.5 2.5 0 0 1 4 25.5V22"/>
</g>
<path d="M16 8.5c.7 4 3.5 6.8 7.5 7.5-4 .7-6.8 3.5-7.5 7.5-.7-4-3.5-6.8-7.5-7.5 4-.7 6.8-3.5 7.5-7.5Z" fill="${color}"/>
</svg>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function render(svg, size, file) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path: path.join(here, file), omitBackground: true });
  await page.close();
}
mkdirSync(path.join(here, 'build'), { recursive: true });
mkdirSync(path.join(here, 'assets'), { recursive: true });
await render(APP, 1024, 'build/icon.png');
await render(TRAY('#000000'), 16, 'assets/trayTemplate.png');
await render(TRAY('#000000'), 32, 'assets/trayTemplate@2x.png');
await render(TRAY('#ffffff'), 32, 'assets/tray.png');
await render(APP, 32, 'assets/tray-win.png');
await browser.close();
console.log('icons written');
