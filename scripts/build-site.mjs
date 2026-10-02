import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Publish only the website. Internal tests, draft copy and repository files
// must never become downloadable marketing-site content.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const entries = ['index.html', '404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers', '_redirects',
  'assets', 'unleashed', 'thanks', 'terms', 'privacy', 'refunds', 'support', 'tutorials'];
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
console.log('Website prepared in dist/; internal files excluded.');
