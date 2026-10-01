import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');
await test('an unopened support iframe does not report an error during its initial blank load', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.wickhunterunleashed.com/unleashed/', runScripts: 'outside-only' });
  dom.window.fetch = async () => ({ ok: false, json: async () => ({ ok: false }) });
  try {
    dom.window.eval(script);
    const frame = dom.window.document.querySelector('.support-window iframe');
    frame.dispatchEvent(new dom.window.Event('load'));
    const status = dom.window.document.querySelector('.support-window-loading');
    assert.equal(status.textContent, 'Loading your conversation…');
    assert.equal(status.querySelector('button'), null);
    assert.equal(dom.window.document.querySelector('.support-window').hidden, true);
  } finally { dom.window.close(); }
});
