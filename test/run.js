const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', 'docs'), MOCK = path.join(__dirname, 'mock');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } const ext = path.extname(f); r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }).listen(8765);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 1400 }, locale: 'it-IT', serviceWorkers: 'block' });
  await ctx.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)/, (route, req) => { const n = req.url().match(/(firebase-[a-z]+\.js)/)[1]; route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(MOCK, n)) }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const step = process.argv[2] || 'owner';
  await p.goto('http://localhost:8765/');
  if (step === 'nologin') { await p.waitForTimeout(800); console.log((await p.textContent('#accesso')).replace(/\s+/g,' ')); await p.screenshot({ path: path.join(__dirname, 'login.png') }); }
  else {
    const user = step === 'stranger' ? { uid: 'u2', email: 'x@y.it', emailVerified: true, providerData: [{ providerId: 'google.com' }], displayName: 'X' } : { uid: 'u1', email: 'rosso.simone95@gmail.com', emailVerified: true, providerData: [{ providerId: 'google.com' }], displayName: 'Simone' };
    await p.evaluate((u) => { localStorage.setItem('mockUser', JSON.stringify(u)); localStorage.setItem('rg-tab', 'importa'); }, user);
    if (step === 'stranger') await p.evaluate(() => localStorage.setItem('mockStore', JSON.stringify([['config/membri', { emails: ['rosso.simone95@gmail.com'], admins: [], persone: {} }]])));
    await p.reload(); await p.waitForTimeout(800);
    console.log('accesso hidden:', await p.$eval('#accesso', (e) => e.hidden), '|', (await p.textContent('#accesso')).replace(/\s+/g, ' ').slice(0, 160));
    if (step === 'owner') {
      p.on('dialog', (d) => d.accept());
      await p.setInputFiles('#app-import', process.argv[3]);
      await p.waitForTimeout(1500);
      console.log('status:', await p.evaluate(() => [...document.querySelectorAll('.status')].map((x) => x.textContent).join(' | ')));
      await p.evaluate(() => { localStorage.setItem('rg-tab', 'giorni'); }); await p.reload(); await p.waitForTimeout(1500);
      console.log('days rows:', (await p.$$('[data-day]')).length, 'banner:', await p.$$eval('.notice.warn', (x) => x.length));
      await p.fill('#app-nuova-mail', '').catch(() => {});
      await p.screenshot({ path: path.join(__dirname, 'giorni.png') });
      await p.evaluate(() => { localStorage.setItem('rg-tab', 'importa'); }); await p.reload(); await p.waitForTimeout(800);
      await p.fill('#app-nuova-mail', 'papa@gmail.com'); await p.click('[data-app-aggiungi]'); await p.waitForTimeout(300);
      console.log('membri:', await p.evaluate(() => JSON.stringify(window.__mockStore.get('config/membri'))));
      await p.screenshot({ path: path.join(__dirname, 'impostazioni.png'), fullPage: true });
      console.log('store keys sample:', await p.evaluate(() => [...window.__mockStore.keys()].filter(k => k.startsWith('data/')).slice(0,2)));
    }
  }
  console.log('errors:', errs.slice(0, 5));
  await b.close(); srv.close();
})();
