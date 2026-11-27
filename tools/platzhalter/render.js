const { chromium } = require('playwright'); const fs = require('fs');
const D = process.argv[2]; const meta = JSON.parse(fs.readFileSync(D + '/svg/meta.json'));
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  for (const [n, [W, H]] of Object.entries(meta)) {
    await p.setViewportSize({ width: W, height: H });
    await p.setContent('<html><body style="margin:0">' + fs.readFileSync(D + '/svg/' + n + '.svg', 'utf8') + '</body></html>');
    await p.screenshot({ path: D + '/png/' + n + '.png' });
  } await b.close(); })();
