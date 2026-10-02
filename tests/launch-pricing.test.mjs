import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../unleashed/index.html', import.meta.url), 'utf8');
const homeHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');
const firstPayment = Date.parse('2026-10-15T00:00:00-04:00');
const redeemUntil = Date.parse('2026-10-16T00:00:00-04:00');
const prelaunch = Date.parse('2026-09-30T12:00:00-04:00');
const response = (body, ok = true) => ({ ok, json: async () => body });
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const plans = (active = true, crypto = true) => ({
  ok: true,
  mode: 'live',
  launch: { active, firstPaymentAtMs: firstPayment,
    redeemUntilMs: redeemUntil, cryptoEnabled: crypto },
  plans: [
    { key: 'monthly', amountCents: 9900, cryptoAvailable: false },
    { key: 'yearly', amountCents: 69900, cryptoAvailable: crypto },
    { key: 'lifetime', amountCents: 99900, cryptoAvailable: crypto },
  ],
});
const hosting = { ok: true, purchasable: true, priceIsProposed: false, bundleEnabled: true,
  monthlyPriceLabel: '$20.00', planLabel: 'Private VPS', regions: [{ label: 'Japan' }],
  managedBackupsIncluded: false, maximumConnectedAccounts: 5 };

async function page({ now = prelaunch, billing = plans(), checkout = () => response(null, false), referral = null, home = false } = {}) {
  const dom = new JSDOM(home ? homeHtml : html, { url: 'https://wickhunterunleashed.com/' + (home ? '' : 'unleashed/') + (referral ? '?ref=' + encodeURIComponent(referral) : ''), runScripts: 'outside-only' });
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

test('verified free period shows full public prices and distinguishes immediate payments', async () => {
  const ctx = await page();
  try {
    const { dom } = ctx;
    assert.equal(dom.window.document.querySelector('[data-launch-offer]').hidden, false);
    assert.equal(dom.window.document.querySelector('[data-free-announcement]').hidden, false);
    assert.equal(dom.window.document.querySelector('[data-availability-announcement]').hidden, true);
    assert.match(dom.window.document.querySelector('[data-launch-offer]').textContent, /\$0 until midnight at the start of October 15/);
    assert.equal(dom.window.document.querySelector('[data-launch-free-copy]').textContent, 'Your first software charge uses the price confirmed at checkout.');
    assert.match(dom.window.document.querySelector('[data-launch-offer]').textContent, /Start free until October 15/);
    assert.doesNotMatch(dom.window.document.querySelector('[data-launch-offer]').textContent, /discount|promo code|25%/i);
    for (const [plan, price] of [['monthly', '99'], ['yearly', '699'], ['lifetime', '999']]) {
      const item = card(dom, plan);
      assert.equal(item.querySelector('[data-plan-price]').textContent, price);
      assert.equal(item.querySelector('[data-launch-old-price]'), null);
      assert.equal(item.querySelector('[data-launch-terms]').hidden, false);
    }
    assert.match(card(dom, 'monthly').querySelector('[data-launch-terms]').textContent, /Card required. \$0 today/);
    assert.match(card(dom, 'yearly').querySelector('[data-launch-terms]').textContent, /first yearly charge on Oct 15/);
    assert.match(card(dom, 'lifetime').querySelector('[data-launch-terms]').textContent, /One-time software payment today/);
    assert.equal(card(dom, 'yearly').querySelector('[data-crypto-buy]').hidden, false);
    assert.equal(card(dom, 'lifetime').querySelector('[data-crypto-buy]').hidden, false);
  } finally { ctx.dom.window.close(); }
});

test('legacy discount fields do not change public prices or send an automatic code', async () => {
  const billing = plans();
  billing.launch.code = 'OLD-PUBLIC-CODE';
  billing.launch.discountPercent = 40;
  billing.plans.forEach(plan => { plan.discountedAmountCents = Math.round(plan.amountCents * .6); });
  const seen = [];
  const ctx = await page({ billing, checkout: body => {
    seen.push(body);
    return response({ ok: true, url: 'https://checkout.stripe.com/c/pay/base-price' });
  } });
  try {
    assert.equal(card(ctx.dom, 'monthly').querySelector('[data-plan-price]').textContent, '99');
    assert.equal(card(ctx.dom, 'yearly').querySelector('[data-plan-price]').textContent, '699');
    assert.equal(card(ctx.dom, 'lifetime').querySelector('[data-plan-price]').textContent, '999');
    click(ctx.dom, card(ctx.dom, 'monthly').querySelector('[data-software-buy]'));
    await settle();
    assert.equal(seen.length, 1);
    assert.equal(seen[0].referral, undefined);
    assert.deepEqual(ctx.navigations, ['https://checkout.stripe.com/c/pay/base-price']);
  } finally { ctx.dom.window.close(); }
});

test('home-page free-period announcement appears only while the verified period is active', async () => {
  const active = await page({ home: true });
  try {
    const announcement = active.dom.window.document.querySelector('[data-free-announcement]');
    assert.equal(announcement.hidden, false);
    assert.match(announcement.textContent, /Monthly and Yearly Unleashed software are free until October 15 with a card/);
  } finally { active.dom.window.close(); }
  const expired = await page({ home: true, now: firstPayment });
  try {
    assert.equal(expired.dom.window.document.querySelector('[data-free-announcement]').hidden, true);
  } finally { expired.dom.window.close(); }
});

test('the card free period ends at midnight Oct 15 ET, and a stale offer ends at midnight Oct 16 ET', async () => {
  const ctx = await page({ now: firstPayment });
  try {
    assert.match(card(ctx.dom, 'monthly').querySelector('[data-launch-terms]').textContent, /charge today/);
    assert.doesNotMatch(card(ctx.dom, 'monthly').querySelector('[data-launch-terms]').textContent, /\$0 today/);
    assert.equal(ctx.dom.window.document.querySelector('[data-launch-offer]').hidden, true);
    assert.equal(ctx.dom.window.document.querySelector('[data-free-announcement]').hidden, true);
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
    assert.equal(card(noCrypto.dom, 'yearly').querySelector('[data-plan-price]').textContent, '699');
    assert.equal(card(noCrypto.dom, 'yearly').querySelector('[data-crypto-buy]').hidden, true);
    assert.equal(noCrypto.dom.window.document.querySelector('[data-launch-crypto-copy]').hidden, true);
  } finally { noCrypto.dom.window.close(); }
});

test('a Hub test-mode response never offers a public purchase or free-period claim', async () => {
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
    assert.equal(yearly.querySelector('[data-plan-price]').textContent, '699');
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

test('after the offer expires combined hosting uses the full bundle price without launch free-period copy', async () => {
  const ctx = await page({ now: redeemUntil });
  try {
    for (const [plan, price] of [['monthly', '119'], ['yearly', '939']]) {
      const item = card(ctx.dom, plan);
      const checkbox = item.querySelector('[data-hosting-select]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new ctx.dom.window.Event('change', { bubbles: true }));
      assert.equal(item.querySelector('[data-plan-price]').textContent, price);
      assert.equal(item.querySelector('[data-launch-terms]').hidden, true);
      assert.equal(item.querySelector('[data-launch-old-price]'), null);
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

test('crypto remains available with separately billed VPS and preserves the hosting handoff', async () => {
  for (const [plan, now] of [['yearly', prelaunch], ['lifetime', prelaunch], ['lifetime', redeemUntil]]) {
    const seen = [];
    const ctx = await page({ now, checkout: body => {
      seen.push(body);
      return response({ ok: true, url: 'https://checkout.stripe.com/c/pay/crypto-hosting' });
    } });
    try {
      const item = card(ctx.dom, plan);
      const checkbox = item.querySelector('[data-hosting-select]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new ctx.dom.window.Event('change', { bubbles: true }));
      const crypto = item.querySelector('[data-crypto-buy]');
      assert.equal(crypto.hidden, false);
      assert.match(item.querySelector('[data-crypto-terms]').textContent, /No automatic renewal/);
      click(ctx.dom, crypto); await settle();
      assert.equal(seen.length, 1);
      assert.equal(seen[0].plan, plan);
      assert.equal(seen[0].payment, 'crypto');
      assert.deepEqual(ctx.navigations, ['https://checkout.stripe.com/c/pay/crypto-hosting']);
      const choice = JSON.parse(ctx.dom.window.localStorage.getItem('wh.hosting-choice.v1'));
      assert.equal(choice.selected, true);
      assert.equal(choice.plan, plan);
      assert.equal(choice.launchSoftwareFirst === true, plan === 'yearly');
      assert.equal(ctx.calls.some(call => call.url.includes('bundle-checkout')), false);
    } finally { ctx.dom.window.close(); }
  }
});

test('starter bonus follows the verified offer and disappears at its deadline', async () => {
  for (const home of [false, true]) {
    for (const [now, billing, expectedVisible] of [
      [Date.parse('2026-10-02T12:00:00Z'), plans(), true],
      [redeemUntil, plans(), false],
      [Date.parse('2026-10-02T12:00:00Z'), plans(false), false],
      [Date.parse('2026-10-02T12:00:00Z'), null, false],
    ]) {
      const ctx = await page({ now, billing, home });
      try {
        const bonuses = [...ctx.dom.window.document.querySelectorAll('[data-starter-announcement]')];
        assert(bonuses.length > 0, 'bonus has a verified availability hook');
        assert(bonuses.every(node => node.hidden === !expectedVisible));
        assert.doesNotMatch(ctx.dom.window.document.body.textContent, /WHVIP25|WHVIP40/);
      } finally { ctx.dom.window.close(); }
    }
  }
});
