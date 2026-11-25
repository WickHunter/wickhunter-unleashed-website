import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
execFileSync(process.execPath, [path.join(root, 'scripts/build-site.mjs')], { cwd: root, stdio: 'pipe' });

const slugs = ['liquidation-bot', 'bybit-trading-bot', 'tradingview-webhook-bot', 'crypto-dca-bot', '3commas-alternative'];
const RISK = 'Trading with leverage can lose more than your deposit. Wick Hunter is trading software, not financial advice.';
const DISCORD = 'https://discord.gg/5QRznnYX6G';
const read = (rel) => readFileSync(path.join(dist, rel), 'utf8');
const doc = (rel) => new JSDOM(read(rel)).window.document;
const text = (node) => node.textContent.replace(/\s+/g, ' ');

test('each SEO landing page is published with a unique title, description and canonical URL', () => {
  const titles = new Set(), descriptions = new Set();
  for (const slug of slugs) {
    const d = doc(`${slug}/index.html`);
    const title = d.querySelector('title')?.textContent.trim();
    const description = d.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
    assert.ok(title, `${slug} title`);
    assert.ok(description && description.length >= 50, `${slug} description`);
    assert.equal(d.querySelector('link[rel="canonical"]')?.getAttribute('href'), `https://wickhunterunleashed.com/${slug}/`);
    assert.equal(d.querySelector('meta[property="og:url"]')?.getAttribute('content'), `https://wickhunterunleashed.com/${slug}/`);
    assert.equal(d.querySelectorAll('h1').length, 1, `${slug} has one h1`);
    assert.ok(d.querySelectorAll('main h2').length >= 4, `${slug} has an H2 structure`);
    assert.ok(d.querySelectorAll('.faq-item .faq-q').length >= 3, `${slug} has an FAQ`);
    titles.add(title); descriptions.add(description);
  }
  assert.equal(titles.size, slugs.length, 'titles are unique');
  assert.equal(descriptions.size, slugs.length, 'descriptions are unique');
});

test('each landing page carries the risk line and avoids promise, trial and demo wording', () => {
  for (const slug of slugs) {
    const d = doc(`${slug}/index.html`);
    assert.ok(text(d.querySelector('main')).includes(RISK), `${slug} risk line`);
    // The shared legal footer keeps its "software does not guarantee results"
    // disclaimer, so the wording check covers the page's own copy: head + main.
    const own = (text(d.querySelector('head')) + ' ' + [...d.querySelectorAll('meta')].map((m) => m.getAttribute('content') || '').join(' ') + ' ' + text(d.querySelector('main'))).toLowerCase();
    for (const banned of ['guarantee', 'passive income', 'free trial', 'demo']) assert.ok(!own.includes(banned), `${slug} contains "${banned}"`);
    assert.ok(text(d.querySelector('footer')).includes('does not guarantee results'), `${slug} keeps the footer disclaimer`);
  }
});

test('landing pages are linked from the footers, cross-linked, and listed in the sitemap', () => {
  const sitemap = read('sitemap.xml');
  for (const page of ['index.html', 'unleashed/index.html', ...slugs.map((s) => `${s}/index.html`)]) {
    const d = doc(page);
    const footerLinks = new Set([...d.querySelectorAll('footer a[href]')].map((a) => a.getAttribute('href')));
    for (const slug of slugs) assert.ok(footerLinks.has(`/${slug}/`), `${page} footer links /${slug}/`);
  }
  for (const slug of slugs) {
    assert.ok(sitemap.includes(`<loc>https://wickhunterunleashed.com/${slug}/</loc>`), `sitemap lists ${slug}`);
    const d = doc(`${slug}/index.html`);
    const mainLinks = [...d.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href'));
    assert.ok(mainLinks.some((h) => h.startsWith('/docs/')), `${slug} links to /docs/`);
    assert.ok(mainLinks.includes('/#pricing'), `${slug} links to pricing`);
    for (const other of slugs.filter((s) => s !== slug)) assert.ok(mainLinks.includes(`/${other}/`), `${slug} links /${other}/`);
    // Copied header/footer anchors must not point at sections this page lacks.
    for (const a of d.querySelectorAll('a[href^="#"]')) assert.ok(d.getElementById(a.getAttribute('href').slice(1)), `${slug} dangling ${a.getAttribute('href')}`);
  }
});

const htmlFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const file = path.join(dir, name);
  return statSync(file).isDirectory() ? htmlFiles(file) : name.endsWith('.html') ? [file] : [];
});

test('every published page loads Plausible once, with the events script', () => {
  const files = htmlFiles(dist);
  assert.ok(files.length > 30);
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const head = html.slice(0, html.search(/<\/head>/i));
    assert.equal(head.split('https://plausible.io/js/pa-nrxKykU4AAIvf_6uk7Sxg.js').length - 1, 1, `${path.relative(dist, file)} Plausible script`);
    assert.ok(head.includes('plausible.init()'), `${path.relative(dist, file)} Plausible init`);
    assert.ok(head.includes('/assets/analytics.js'), `${path.relative(dist, file)} events script`);
  }
});

test('footers carry the Discord invite', () => {
  for (const page of ['index.html', 'unleashed/index.html', ...slugs.map((s) => `${s}/index.html`)]) {
    const links = [...doc(page).querySelectorAll('footer a[href]')].map((a) => a.getAttribute('href'));
    assert.ok(links.includes(DISCORD), `${page} footer Discord link`);
  }
});

test('"Checkout Start" and "Discord Join" fire on the matching clicks', () => {
  const script = read('assets/analytics.js');
  const dom = new JSDOM(`<!doctype html><body>
    <article data-plan="yearly"><a id="card" href="/buy?plan=yearly">Buy</a><a id="crypto" href="/buy?plan=lifetime&payment=crypto">Crypto</a></article>
    <article data-plan="monthly"><a id="noplan" href="/buy">Buy</a></article>
    <a id="hub" href="https://hub.wickhunterunleashed.com/buy?plan=monthly">Hub</a>
    <a id="disabled" aria-disabled="true" href="/buy?plan=monthly">Wait</a>
    <a id="discord" href="${DISCORD}"><span id="inner">Join</span></a>
    <a id="other" href="/docs/">Docs</a></body>`, { url: 'https://www.wickhunterunleashed.com/', runScripts: 'outside-only' });
  const events = [];
  dom.window.plausible = (name, options) => events.push(JSON.parse(JSON.stringify([name, options?.props ?? null])));
  dom.window.eval(script);
  dom.window.document.addEventListener('click', (e) => e.preventDefault());
  for (const id of ['card', 'crypto', 'noplan', 'hub', 'disabled', 'inner', 'other']) {
    dom.window.document.getElementById(id).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  assert.deepEqual(events, [
    ['Checkout Start', { plan: 'yearly' }],
    ['Checkout Start', { plan: 'lifetime' }],
    ['Checkout Start', { plan: 'monthly' }],
    ['Checkout Start', { plan: 'monthly' }],
    ['Discord Join', null],
  ]);
  dom.window.close();
});
