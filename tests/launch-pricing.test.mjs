import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../unleashed/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');
const firstPayment = Date.parse('2026-10-15T00:00:00-04:00');
const redeemUntil = Date.parse('2026-10-16T00:00:00-04:00');
const prelaunch = Date.parse('2026-09-30T12:00:00-04:00');
const response = (body, ok = true) => ({ ok, json: async () => body });
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const plans = (active = true, crypto = true) => ({
  ok: true,
  mode: 'live',
  launch: { active, code: 'UNLEASHED25', discountPercent: 25, firstPaymentAtMs: firstPayment,
    redeemUntilMs: redeemUntil, cryptoEnabled: crypto },
  plans: [
    { key: 'monthly', amountCents: 9900, discountedAmountCents: 7425, cryptoAvailable: false },
    { key: 'yearly', amountCents: 69900, discountedAmountCents: 52425, cryptoAvailable: crypto },
    { key: 'lifetime', amountCents: 99900, discountedAmountCents: 74925, cryptoAvailable: crypto },
  ],
});
const hosting = { ok: true, purchasable: true, priceIsProposed: false, bundleEnabled: true,
  monthlyPriceLabel: '$20.00', planLabel: 'Private VPS', regions: [{ label: 'Japan' }],
  managedBackupsIncluded: false, maximumConnectedAccounts: 5 };

async function page({ now = prelaunch, billing = plans(), checkout = () => response(null, false), referral = null } = {}) {
  const dom = new JSDOM(html, { url: 'https://wickhunterunleashed.com/unleashed/' + (referral ? '?ref=' + encodeURIComponent(referral) : ''), runScripts: 'outside-only' });
  const calls = [], navigations = [];
  let counter = 0;
  dom.window.Date.now = () => now;
  Object.defineProperty(dom.window.crypto, 'randomUUID', { value: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` });
  dom.window.HTMLAnchorElement.prototype.click = function () { navigations.push(this.href); };
  dom.window.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/api/billing/plans')) return response(billing);
    if (String(url).includes('/api/hosting/options')) return response(hosting);
    if (String(url).includes('/api/billing/checkout')) return checkout(JSON.parse(init.body), init);
    return response(null, false);
  };
  dom.window.eval(script);
  await settle();
  return { dom, calls, navigations, setNow: value => { now = value; } };
}

const card = (dom, plan) => dom.window.document.querySelector(`[data-plan="${plan}"]`);
const click = (dom, link) => link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

test('verified offer shows exact recurring and one-time amounts with a free card period', async () => {
  const ctx = await page();
  try {
    const { dom } = ctx;
    assert.equal(dom.window.document.querySelector('[data-launch-offer]').hidden, false);
    assert.match(dom.window.document.querySelector('[data-launch-free-copy]').textContent, /\$0 until Oct 15/);
    for (const [plan, price, old] of [['monthly', '74.25', '$99'], ['yearly', '524.25', '$699'], ['lifetime', '749.25', '$999']]) {
      const item = card(dom, plan);
      assert.equal(item.querySelector('[data-plan-price]').textContent, price);
      assert.equal(item.querySelector('[data-launch-old-price]').textContent, old);
      assert.equal(item.querySelector('[data-launch-terms]').hidden, false);
    }
    assert.match(card(dom, 'monthly').querySelector('[data-launch-terms]').textContent, /Card required. \$0 today/);
    assert.match(card(dom, 'yearly').querySelector('[data-launch-terms]').textContent, /renewals while active/);
    assert.match(card(dom, 'lifetime').querySelector('[data-launch-terms]').textContent, /one-time payment today/);
    assert.equal(card(dom, 'yearly').querySelector('[data-crypto-buy]').hidden, false);
    assert.equal(card(dom, 'lifetime').querySelector('[data-crypto-buy]').hidden, false);
  } finally { ctx.dom.window.close(); }
});

test('the card free period ends at midnight Oct 15 ET, and a stale offer ends at midnight Oct 16 ET', async () => {
  const ctx = await page({ now: firstPayment });
  try {
    assert.match(card(ctx.dom, 'monthly').querySelector('[data-launch-terms]').textContent, /charged today/);
    assert.doesNotMatch(card(ctx.dom, 'monthly').querySelector('[data-launch-terms]').textContent, /\$0 today/);
    ctx.setNow(redeemUntil);
    const checkbox = card(ctx.dom, 'monthly').querySelector('[data-hosting-select]');
    checkbox.dispatchEvent(new ctx.dom.window.Event('change', { bubbles: true }));
    assert.equal(ctx.dom.window.document.querySelector('[data-launch-offer]').hidden, true);
    assert.equal(card(ctx.dom, 'monthly').querySelector('[data-plan-price]').textContent, '99');
    assert.equal(card(ctx.dom, 'yearly').querySelector('[data-crypto-buy]').hidden, false);
    assert.equal(card(ctx.dom, 'yearly').querySelector('[data-crypto-buy]').textContent, 'Pay $699 with crypto');
  } finally { ctx.dom.window.close(); }
});

test('an inactive offer uses full prices while separately confirmed crypto availability remains visible', async () => {
  const inactive = await page({ billing: plans(false) });
  try {
    assert.equal(inactive.dom.window.document.querySelector('[data-launch-offer]').hidden, true);
    assert.equal(card(inactive.dom, 'yearly').querySelector('[data-plan-price]').textContent, '699');
    assert.equal(card(inactive.dom, 'yearly').querySelector('[data-crypto-buy]').hidden, false);
    assert.equal(card(inactive.dom, 'yearly').querySelector('[data-crypto-buy]').textContent, 'Pay $699 with crypto');
  } finally { inactive.dom.window.close(); }
  const noCrypto = await page({ billing: plans(true, false) });
  try {
    assert.equal(card(noCrypto.dom, 'yearly').querySelector('[data-plan-price]').textContent, '524.25');
    assert.equal(card(noCrypto.dom, 'yearly').querySelector('[data-crypto-buy]').hidden, true);
    assert.equal(noCrypto.dom.window.document.querySelector('[data-launch-crypto-copy]').hidden, true);
  } finally { noCrypto.dom.window.close(); }
});

test('a Hub test-mode response never offers a public purchase or launch promotion', async () => {
  const ctx = await page({ billing: { ...plans(), mode: 'test' } });
  try {
    assert.equal(ctx.dom.window.document.querySelector('[data-launch-offer]').hidden, true);
    assert.equal(card(ctx.dom, 'monthly').querySelector('[data-plan-price]').textContent, '99');
    assert.equal(card(ctx.dom, 'monthly').querySelector('[data-software-buy]').getAttribute('aria-disabled'), 'true');
    assert.equal(card(ctx.dom, 'yearly').querySelector('[data-crypto-buy]').hidden, true);
    assert.match(card(ctx.dom, 'monthly').querySelector('[data-hosting-card-status]').textContent, /test mode/);
  } finally { ctx.dom.window.close(); }
});

test('a landing-page referral follows the card and crypto checkout paths without changing the public launch price', async () => {
  const seen = [];
  const ctx = await page({ referral: 'ALPHA2026', checkout: body => {
    seen.push(body);
    return response({ ok: true, url: 'https://checkout.stripe.com/c/pay/referral' });
  } });
  try {
    const yearly = card(ctx.dom, 'yearly');
    assert.equal(yearly.querySelector('[data-plan-price]').textContent, '524.25');
    assert.equal(yearly.querySelector('[data-software-buy]').getAttribute('href'), '/buy?plan=yearly&ref=ALPHA2026');
    assert.equal(yearly.querySelector('[data-crypto-buy]').getAttribute('href'), '/buy?plan=yearly&payment=crypto&ref=ALPHA2026');
    click(ctx.dom, yearly.querySelector('[data-crypto-buy]')); await settle();
    assert.equal(seen[0].referral, 'ALPHA2026');
    assert.equal(seen[0].payment, 'crypto');
  } finally { ctx.dom.window.close(); }
});

test('only a confirmed inactive referral falls back to a separate no-referral checkout attempt', async () => {
  const seen = [];
  const ctx = await page({ referral: 'OLD-CODE', checkout: body => {
    seen.push(body);
    return seen.length === 1
      ? response({ ok: false, error: 'Referral discount is not active' }, false)
      : response({ ok: true, url: 'https://checkout.stripe.com/c/pay/launch-only' });
  } });
  try {
    click(ctx.dom, card(ctx.dom, 'monthly').querySelector('[data-software-buy]'));
    await settle();
    assert.equal(seen.length, 2);
    assert.equal(seen[0].referral, 'OLD-CODE');
    assert.equal(seen[1].referral, undefined);
    assert.notEqual(seen[0].attemptId, seen[1].attemptId);
    assert.deepEqual(ctx.navigations, ['https://checkout.stripe.com/c/pay/launch-only']);
  } finally { ctx.dom.window.close(); }
});

test('combined hosting remains at its full bundle price with no launch free-period copy', async () => {
  const ctx = await page();
  try {
    for (const [plan, price] of [['monthly', '119'], ['yearly', '939']]) {
      const item = card(ctx.dom, plan);
      const checkbox = item.querySelector('[data-hosting-select]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new ctx.dom.window.Event('change', { bubbles: true }));
      assert.equal(item.querySelector('[data-plan-price]').textContent, price);
      assert.equal(item.querySelector('[data-launch-terms]').hidden, true);
      assert.equal(item.querySelector('[data-launch-old-price]').hidden, true);
      assert.equal(item.querySelector('[data-crypto-buy]')?.hidden ?? true, true);
    }
  } finally { ctx.dom.window.close(); }
});

test('launch checkout posts a stable attempt on retry, switches payment identity, and rejects non-Stripe URLs', async () => {
  const seen = [];
  const ctx = await page({ checkout: body => {
    seen.push(body);
    if (seen.length === 1) return response(null, false);
    if (seen.length === 2) return response({ ok: true, url: 'https://checkout.stripe.com/c/pay/card' });
    if (seen.length === 3) return response({ ok: true, url: 'https://evil.example/pay' });
    return response({ ok: true, url: 'https://checkout.stripe.com/c/pay/crypto' });
  } });
  try {
    const monthly = card(ctx.dom, 'monthly').querySelector('[data-software-buy]');
    click(ctx.dom, monthly); await settle();
    assert.match(card(ctx.dom, 'monthly').querySelector('[data-hosting-card-status]').textContent, /same checkout attempt/);
    click(ctx.dom, monthly); await settle();
    assert.deepEqual(seen.slice(0, 2).map(item => item.attemptId), [seen[0].attemptId, seen[0].attemptId]);
    assert.deepEqual(ctx.navigations, ['https://checkout.stripe.com/c/pay/card']);
    const yearlyCrypto = card(ctx.dom, 'yearly').querySelector('[data-crypto-buy]');
    click(ctx.dom, yearlyCrypto); await settle();
    assert.deepEqual(ctx.navigations, ['https://checkout.stripe.com/c/pay/card']);
    click(ctx.dom, yearlyCrypto); await settle();
    assert.equal(seen[2].attemptId, seen[3].attemptId);
    assert.notEqual(seen[0].attemptId, seen[2].attemptId);
    assert.deepEqual(ctx.navigations, ['https://checkout.stripe.com/c/pay/card', 'https://checkout.stripe.com/c/pay/crypto']);
    delete monthly.dataset.pending;
    monthly.setAttribute('aria-disabled', 'false');
    click(ctx.dom, monthly); await settle();
    assert.equal(seen[4].attemptId, seen[0].attemptId, 'switching back to a plan keeps its pending checkout identity');
    assert.deepEqual(seen.map(({ plan, payment }) => [plan, payment]),
      [['monthly', 'card'], ['monthly', 'card'], ['yearly', 'crypto'], ['yearly', 'crypto'], ['monthly', 'card']]);
  } finally { ctx.dom.window.close(); }
});
