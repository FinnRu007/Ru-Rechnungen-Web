// Echter Test des SEO- und GEO-Checks gegen echte Webseiten.
// Die Seite wird lokal ausgeliefert, aber unter https://ru-services.de
// aufgerufen, damit die Abrufdienste dieselbe Herkunft sehen wie im Betrieb.
// Aufruf: node tests/seo-geo-check.e2e.js <ausgabeordner>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || 'test-ergebnisse';
fs.mkdirSync(OUT, { recursive: true });
const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };

const SEITEN = (process.env.SEITEN || [
  'ru-services.de',
  'https://www.handwerk.de/',
  'www.zdf.de',
  'https://www.otto.de/',
  'https://www.tischler.de/',
  'https://www.bundesregierung.de/',
  'https://www.wikipedia.org/',
  'https://www.github.com/',
  'https://www.wix.com/',
  'https://www.ihk.de/',
  'https://www.gibt-es-sicher-nicht-12345.de/'
].join(',')).split(',');

(async () => {
  const browser = await chromium.launch();
  const ergebnisse = [];
  for (const scheme of ['light']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    await ctx.route('https://ru-services.de/**', async (route) => {
      const u = new URL(route.request().url());
      // Nur die Werkzeugdateien lokal, robots.txt usw. der echten Domain bleiben echt,
      // wenn sie über einen Abrufdienst geholt werden (dann ist der Host ein anderer).
      let p = decodeURIComponent(u.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPEN[path.extname(f)] || 'application/octet-stream' } });
      }
      return route.fulfill({ status: 404, body: 'nicht gefunden' });
    });
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto('https://ru-services.de/webseiten/seo-geo-check/');
    for (const seite of SEITEN) {
      const t0 = Date.now();
      await page.evaluate(() => { window.__letzterWeg = null; window.__nebendateien = null; });
      await page.fill('#urlInput', seite);
      await page.click('#checkBtn');
      let status = 'ok';
      try {
        await page.waitForFunction(() => !document.querySelector('#checkBtn').disabled, null, { timeout: 120000 });
      } catch (e) { status = 'zeitueberschreitung'; }
      const r = await page.evaluate(() => {
        const sichtbar = !document.querySelector('#result').hidden && !!window.__letzterWeg;
        return {
          ergebnis: sichtbar,
          seo: sichtbar ? document.querySelector('#score-seo .score-num').textContent : null,
          geo: sichtbar ? document.querySelector('#score-geo .score-num').textContent : null,
          weg: window.__letzterWeg || null,
          nebendateien: window.__nebendateien || null,
          meldung: document.querySelector('#toolMsg').innerText.slice(0, 160),
          schlecht: [...document.querySelectorAll('#resBad .check-title')].map((x) => x.childNodes[0].textContent.trim()),
          info: [...document.querySelectorAll('#resInfo .check-title')].map((x) => x.childNodes[0].textContent.trim())
        };
      });
      const zeile = Object.assign({ seite, status, sekunden: Math.round((Date.now() - t0) / 100) / 10 }, r);
      ergebnisse.push(zeile);
      console.log(JSON.stringify(zeile));
      const name = seite.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]+/gi, '_').replace(/_$/, '');
      if (r.ergebnis && /ru-services|handwerk/.test(seite)) {
        await page.screenshot({ path: path.join(OUT, `ergebnis-${name}-${scheme}.png`), fullPage: true });
      }
      await page.waitForTimeout(1500);
    }
    if (fehler.length) console.log('SEITENFEHLER', fehler);
    await ctx.close();
  }
  // Dunkelmodus und Handy einmal mit ru-services.de
  for (const v of [{ n: 'dunkel', o: { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' } }, { n: 'handy', o: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' } }]) {
    const ctx = await browser.newContext(v.o);
    await ctx.route('https://ru-services.de/**', async (route) => {
      const u = new URL(route.request().url());
      let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPEN[path.extname(f)] || 'application/octet-stream' } });
      return route.fulfill({ status: 404, body: '' });
    });
    const page = await ctx.newPage();
    await page.goto('https://ru-services.de/webseiten/seo-geo-check/');
    await page.screenshot({ path: path.join(OUT, `start-${v.n}.png`), fullPage: v.n === 'handy' });
    await page.fill('#urlInput', 'https://www.handwerk.de/');
    await page.click('#checkBtn');
    await page.waitForFunction(() => !document.querySelector('#checkBtn').disabled, null, { timeout: 120000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, `ergebnis-handwerk-${v.n}.png`), fullPage: true });
    await page.goto('https://ru-services.de/webseiten/');
    await page.screenshot({ path: path.join(OUT, `webseiten-${v.n}.png`), fullPage: true });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'ergebnisse.json'), JSON.stringify(ergebnisse, null, 2));
  const fehlgeschlagen = ergebnisse.filter((e) => !e.ergebnis && !/gibt-es-sicher-nicht/.test(e.seite));
  console.log(`\n${ergebnisse.length - fehlgeschlagen.length} von ${ergebnisse.length} Seiten ausgewertet.`);
  if (fehlgeschlagen.length > 2) process.exit(1);
})();
