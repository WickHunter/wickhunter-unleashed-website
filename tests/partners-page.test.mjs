import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
execFileSync(process.execPath, [path.join(root, 'scripts/build-site.mjs')], { cwd: root, stdio: 'pipe' });
const doc = (rel) => new JSDOM(readFileSync(path.join(dist, rel), 'utf8')).window.document;
const RISK = 'Trading with leverage can lose more than your deposit. Wick Hunter is trading software, not financial advice.';

test('partner page is published with its terms and contact', () => {
  const d = doc('partners/index.html');
  assert.ok(d.querySelector('title')?.textContent.includes('Partner'));
  assert.ok((d.querySelector('meta[name="description"]')?.getAttribute('content') || '').length >= 50);
  assert.equal(d.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://wickhunterunleashed.com/partners/');
  assert.equal(d.querySelectorAll('h1').length, 1);
  const main = d.querySelector('main').textContent.replace(/\s+/g, ' ');
  for (const s of ['60-day', '$50', 'Recurring', 'partners@getwickhunter.com', RISK]) assert.ok(main.includes(s), `contains ${s}`);
  for (const bad of [/guarantee/i, /passive income(?!")/i, /free trial/i, /\bdemo\b(?! or backtest)/i, /\bgrid\b/i]) assert.ok(!bad.test(main.replace('"passive income"', '')), `must not contain ${bad}`);
});

test('partner page is linked from the footers and the sitemap', () => {
  for (const rel of ['index.html', 'unleashed/index.html', 'liquidation-bot/index.html', 'bybit-trading-bot/index.html', 'tradingview-webhook-bot/index.html', 'crypto-dca-bot/index.html', '3commas-alternative/index.html']) {
    assert.ok(doc(rel).querySelector('footer a[href="/partners/"]'), `${rel} footer links /partners/`);
  }
  assert.ok(readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').includes('https://wickhunterunleashed.com/partners/'));
});
