import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Publish only the website. Internal tests, draft copy and repository files
// must never become downloadable marketing-site content.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const entries = ['index.html', '404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers', '_redirects',
  'assets', 'unleashed', 'thanks', 'terms', 'privacy', 'refunds', 'support', 'tutorials', 'docs',
  'liquidation-bot', 'bybit-trading-bot', 'tradingview-webhook-bot', 'crypto-dca-bot', '3commas-alternative'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
function copy(relative) {
  const source = path.join(root, relative), target = path.join(out, relative);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error('Website publication cannot include symbolic links');
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      if (name.startsWith('.')) throw new Error('Hidden file found in a public website directory');
      copy(path.join(relative, name));
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}
entries.forEach(copy);

// Plausible analytics on every published page. docs/ is generated from the app
// repository, so the snippet is added here rather than edited into the HTML.
export const PLAUSIBLE_SNIPPET = `<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-nrxKykU4AAIvf_6uk7Sxg.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>
<script src="/assets/analytics.js?v=20261125" defer></script>`;
function addAnalytics(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) { addAnalytics(file); continue; }
    if (!name.endsWith('.html')) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes('plausible.io/js/pa-nrxKykU4AAIvf_6uk7Sxg.js')) continue;
    const at = html.search(/<\/head>/i);
    if (at < 0) throw new Error('Cannot add analytics: no </head> in ' + path.relative(out, file));
    fs.writeFileSync(file, html.slice(0, at) + PLAUSIBLE_SNIPPET + '\n' + html.slice(at));
  }
}
addAnalytics(out);
console.log('Website prepared in dist/; internal files excluded.');
