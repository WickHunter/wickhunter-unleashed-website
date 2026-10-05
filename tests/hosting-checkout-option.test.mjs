import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";

const siteJs = readFileSync(new URL("../assets/site.js", import.meta.url), "utf8");
const goodOptions = {
  ok: true, purchasable: true, priceIsProposed: false, bundleEnabled: true,
  monthlyPriceLabel: "$20.00", planLabel: "Private VPS",
  regions: [{ label: "Japan" }], managedBackupsIncluded: false,
  maximumConnectedAccounts: 5,
};
const launchBilling = {
  ok: true, mode: "live",
  launch: { active: true,
    firstPaymentAtMs: Date.parse("2026-10-15T04:00:00Z"), redeemUntilMs: Date.parse("2026-10-16T04:00:00Z"), cryptoEnabled: false },
  plans: [
    { key: "monthly", amountCents: 9900 },
    { key: "yearly", amountCents: 69900 },
    { key: "lifetime", amountCents: 99900 },
  ],
};
const response = (body, ok = true) => ({ ok, json: async () => body });
const delayed = (value, delayMs) => delayMs ? new Promise((resolve) => setTimeout(() => resolve(value), delayMs)) : value;
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};
async function waitFor(predicate, timeoutMs = 500) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for page state");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

async function page(file, hostingResponse, { remembered = null, bundle = null, billing = null, billingDelayMs = 0, hostingDelayMs = 0 } = {}) {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: `https://wickhunterunleashed.com/${file}`, runScripts: "outside-only" });
  if (billing?.launch?.active) dom.window.Date.now = () => Date.parse("2026-10-01T12:00:00Z");
  const calls = [], navigations = [];
  let uuid = 0;
  Object.defineProperty(dom.window.crypto, "randomUUID", { value: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` });
  if (remembered) dom.window.localStorage.setItem("wh.hosting-choice.v1", JSON.stringify(remembered));
  dom.window.HTMLAnchorElement.prototype.click = function () { navigations.push(this.href); };
  dom.window.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/api/hosting/options")) return delayed(hostingResponse, hostingDelayMs);
    if (String(url).includes("/api/billing/plans")) return delayed(response(billing || { ok: true, mode: 'live', plans: [] }), billingDelayMs);
    if (String(url).includes("/api/hosting/bundle-checkout")) return bundle
      ? bundle(JSON.parse(init.body), init)
      : response(null, false);
    if (String(url).includes("/api/billing/checkout")) return response({ ok: true, url: "https://checkout.stripe.com/c/pay/launch-software" });
    return response({ ok: true, mode: 'live', plans: [] });
  };
  dom.window.eval(siteJs);
  await settle();
  return { dom, calls, navigations };
}

function choose(dom, plan) {
  const card = dom.window.document.querySelector(`[data-plan="${plan}"]`);
  const checkbox = card.querySelector("[data-hosting-select]");
  checkbox.checked = true;
  checkbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  return { card, checkbox, link: card.querySelector("[data-software-buy]") };
}

test('Monthly and Yearly use one combined checkout regardless of offer timing or response order', async () => {
  for (const active of [true, false]) for (const [billingDelayMs, hostingDelayMs] of [[0, 25], [25, 0]]) {
    const billing = { ...launchBilling, launch: { ...launchBilling.launch, active, hostingCheckoutEnabled: true } };
    const ctx = await page('unleashed/index.html', response(goodOptions), { billing, billingDelayMs, hostingDelayMs });
    try {
      await waitFor(() => [...ctx.dom.window.document.querySelectorAll('[data-hosting-select]')].every(box => !box.disabled)
        && ctx.dom.window.document.querySelector('[data-software-buy]').getAttribute('aria-disabled') === 'false');
      for (const plan of ['monthly', 'yearly']) {
        const selected = choose(ctx.dom, plan);
        assert.match(selected.card.querySelector('[data-hosting-card-status]').textContent, /software \+ hosting renewal/);
        assert.equal(selected.card.querySelector('[data-plan-price]').textContent, { monthly: '119', yearly: '939' }[plan]);
        selected.link.dispatchEvent(new ctx.dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        await settle();
        const call = ctx.calls.filter(call => call.url.includes('/api/hosting/bundle-checkout')).at(-1);
        assert.equal(JSON.parse(call.init.body).plan, plan);
      }
      assert.equal(ctx.calls.some(call => call.url === '/api/billing/checkout'), false);
    } finally { ctx.dom.window.close(); }
  }
});

test('Lifetime keeps its separate monthly VPS handoff and checkout identities', async () => {
  const billing = { ...launchBilling, launch: { ...launchBilling.launch, hostingCheckoutEnabled: true } };
  const ctx = await page('unleashed/index.html', response(goodOptions), { billing });
  try {
    const selected = choose(ctx.dom, 'lifetime');
    const attempts = [];
    for (const hosting of [true, false, true]) {
      selected.checkbox.checked = hosting;
      selected.checkbox.dispatchEvent(new ctx.dom.window.Event('change', { bubbles: true }));
      delete selected.link.dataset.pending;
      selected.link.dispatchEvent(new ctx.dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await settle();
      attempts.push(JSON.parse(ctx.calls.filter(call => call.url === '/api/billing/checkout').at(-1).init.body));
    }
    assert.equal(attempts[0].hosting, true);
    assert.equal(attempts[1].hosting, undefined);
    assert.notEqual(attempts[0].attemptId, attempts[1].attemptId);
    assert.equal(attempts[0].attemptId, attempts[2].attemptId);
  } finally { ctx.dom.window.close(); }
});

test("each licence card shows its exact selected hosting billing shape", async () => {
  const { dom } = await page("unleashed/index.html", response(goodOptions));
  try {
    const monthly = choose(dom, "monthly");
    assert.equal(monthly.card.querySelector("[data-plan-price]").textContent, "119");
    assert.match(monthly.card.querySelector("[data-plan-caption]").textContent, /one monthly renewal/);
    assert.equal(monthly.link.textContent, "Buy Monthly + VPS");

    const yearly = choose(dom, "yearly");
    assert.equal(yearly.card.querySelector("[data-plan-price]").textContent, "939");
    assert.match(yearly.card.querySelector("[data-plan-caption]").textContent, /one annual renewal/);
    assert.equal(yearly.link.textContent, "Buy Yearly + VPS");
    assert.equal(yearly.card.querySelector("[data-hosting-yearly-price]").textContent, "$240/year");

    const lifetime = choose(dom, "lifetime");
    assert.equal(lifetime.card.querySelector("[data-plan-price]").textContent, "999");
    assert.match(lifetime.card.querySelector("[data-plan-caption]").textContent, /VPS renews separately monthly/);
    assert.equal(lifetime.link.textContent, "Buy Lifetime, then VPS");
    assert.equal(lifetime.link.getAttribute("href"), "/buy?plan=lifetime");
  } finally { dom.window.close(); }
});

test("active free period shows the combined renewal and sends one bundle checkout", async () => {
  for (const [plan, expectedPrice] of [["monthly", "119"], ["yearly", "939"]]) {
    for (const [billingDelayMs, hostingDelayMs] of [[0, 25], [25, 0]]) {
      const seen = [];
      const ctx = await page("unleashed/index.html", response(goodOptions), {
        billing: launchBilling, billingDelayMs, hostingDelayMs,
        bundle: (body) => { seen.push({ route: "bundle", body }); return response({ ok: true, url: 'https://checkout.stripe.com/c/pay/bundle', pricing: { amountCents: Number(expectedPrice) * 100, interval: plan === 'yearly' ? 'year' : 'month', softwareDays: plan === 'yearly' ? 365 : 30, maximumConnectedAccounts: 5 } }); },
      });
      try {
        const card = ctx.dom.window.document.querySelector(`[data-plan="${plan}"]`);
        await waitFor(() => !card.querySelector("[data-hosting-select]").disabled
          && card.querySelector("[data-software-buy]").getAttribute("aria-disabled") === "false");
        if (plan === "yearly") assert.match(card.querySelector("[data-hosting-card-status]").textContent,
          /\$240 per year/, "Yearly VPS is paid annually");
        const selected = choose(ctx.dom, plan);
        await waitFor(() => selected.card.querySelector("[data-plan-price]").textContent === expectedPrice
          && /software \+ hosting renewal/.test(selected.card.querySelector("[data-hosting-card-status]").textContent));
      assert.equal(selected.card.querySelector("[data-plan-price]").textContent, expectedPrice,
        "selected VPS is included in the renewal price");
      assert.match(selected.card.querySelector("[data-plan-caption]").textContent, /one .* renewal/);
      assert.match(selected.card.querySelector('[data-launch-terms]').textContent, /\$0 today/);
      assert.equal(selected.card.querySelector("[data-hosting-standard-copy]").hidden, false);
      assert.equal(selected.link.textContent, plan === "monthly" ? "Buy Monthly + VPS" : "Buy Yearly + VPS");
      selected.link.dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      await settle();
      assert.deepEqual(ctx.navigations, ["https://checkout.stripe.com/c/pay/bundle"]);
      assert.equal(seen.length, 1);
      const request = ctx.calls.find((call) => call.url.includes('/api/hosting/bundle-checkout'));
      assert.ok(request);
      assert.equal(JSON.parse(request.init.body).plan, plan);
      assert.equal(ctx.calls.some(call => call.url === '/api/billing/checkout'), false);

      const remembered = JSON.parse(ctx.dom.window.localStorage.getItem("wh.hosting-choice.v1"));
      assert.notEqual(remembered.launchSoftwareFirst, true);
      const thanks = await page("thanks/index.html", response(goodOptions), { remembered, billing: launchBilling });
      try {
        await settle();
        assert.equal(thanks.dom.window.document.querySelector("[data-hosting-launch-next]").hidden, true);
        assert.equal(thanks.dom.window.document.querySelector("[data-hosting-combined-next]").hidden, false);
        assert.equal(thanks.dom.window.document.querySelector("[data-hosting-launch-next] a").getAttribute("href"), "/customer#hostingCard");
        assert.equal(thanks.dom.window.document.querySelector("[data-hosting-thanks-launch]").hidden, false);
        } finally { thanks.dom.window.close(); }
      } finally { ctx.dom.window.close(); }
    }
  }
});

test("active launch offer does not promise VPS availability when the hosting options endpoint refuses purchase", async () => {
  const unavailable = { ...goodOptions, purchasable: false };
  const ctx = await page("unleashed/index.html", response(unavailable), { billing: launchBilling });
  try {
    const card = ctx.dom.window.document.querySelector('[data-plan="yearly"]');
    await waitFor(() => card.querySelector("[data-hosting-select]").disabled
      && !ctx.dom.window.document.querySelector("[data-hosting-choice-launch]").hidden);
    assert.match(ctx.dom.window.document.querySelector("[data-hosting-choice-launch]").textContent, /when available/i);
    assert.match(ctx.dom.window.document.querySelector("[data-hosting-selection-status]").textContent, /not available for purchase yet/);
    assert.match(card.querySelector("[data-hosting-launch-copy]").textContent, /when available/);
    card.querySelector("[data-software-buy]").dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.deepEqual(ctx.navigations, ["https://checkout.stripe.com/c/pay/launch-software"]);
    assert.equal(ctx.calls.some((call) => call.url.includes("/api/hosting/bundle-checkout")), false);
  } finally { ctx.dom.window.close(); }
});

test("combined checkout posts the exact plan and reuses one browser attempt id after a retry", async () => {
  let attempts = 0;
  const seen = [];
  const ctx = await page("unleashed/index.html", response(goodOptions), {
    bundle: (body) => {
      seen.push(body);
      attempts++;
      if (attempts === 1) return response(null, false);
      return response({
        ok: true, url: "https://checkout.stripe.com/c/pay/test",
        pricing: { amountCents: 11900, interval: "month", softwareDays: 30, maximumConnectedAccounts: 5 },
      });
    },
  });
  const { dom, navigations } = ctx;
  try {
    const monthly = choose(dom, "monthly");
    monthly.link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.match(monthly.card.querySelector("[data-hosting-card-status]").textContent, /could not be opened/);
    assert.equal(monthly.link.getAttribute("aria-disabled"), "false", "failure permits an explicit retry");

    monthly.link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.equal(seen.length, 2);
    assert.deepEqual(seen.map(({ plan }) => plan), ["monthly", "monthly"]);
    assert.equal(seen[0].checkoutAttemptId, seen[1].checkoutAttemptId,
      "a lost response and retry cannot create two Stripe attempts");
    assert.deepEqual(navigations, ["https://checkout.stripe.com/c/pay/test"]);

    const yearly = choose(dom, "yearly");
    yearly.link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.notEqual(seen[2].checkoutAttemptId, seen[1].checkoutAttemptId,
      "choosing a different billing plan starts a distinct checkout attempt");
  } finally { dom.window.close(); }
});

test('provider outage is identified and leaves the checkout retryable', async () => {
  const ctx = await page('unleashed/index.html', response(goodOptions), {
    bundle: () => response({ok:false,code:'PROVIDER_STATUS_UNKNOWN',error:'upstream unavailable'}, false),
  });
  try {
    const selected = choose(ctx.dom, 'yearly');
    selected.link.dispatchEvent(new ctx.dom.window.MouseEvent('click', {bubbles:true,cancelable:true}));
    await settle();
    assert.match(selected.card.querySelector('[data-hosting-card-status]').textContent, /VPS provider is temporarily unavailable/);
    assert.equal(selected.link.getAttribute('aria-disabled'), 'false');
    assert.equal(ctx.navigations.length, 0);
  } finally { ctx.dom.window.close(); }
});

test("annual checkout requires the exact $939/year response and a Stripe-hosted HTTPS URL", async () => {
  const replies = [
    response({ ok: true, url: "https://evil.example/checkout", pricing: { amountCents: 93900, interval: "year", softwareDays: 365, maximumConnectedAccounts: 5 } }),
    response({ ok: true, url: "https://checkout.stripe.com/c/pay/yearly", pricing: { amountCents: 93900, interval: "year", softwareDays: 365, maximumConnectedAccounts: 5 } }),
  ];
  const ctx = await page("unleashed/index.html", response(goodOptions), { bundle: () => replies.shift() });
  const { dom, navigations } = ctx;
  try {
    const yearly = choose(dom, "yearly");
    yearly.link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.deepEqual(navigations, [], "a non-Stripe redirect is refused");
    yearly.link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.deepEqual(navigations, ["https://checkout.stripe.com/c/pay/yearly"]);
  } finally { dom.window.close(); }
});

test("combined checkout rejects Hub identity fields that differ from current options or plan", async () => {
  const replies = [
    response({
      ok: true, url: "https://checkout.stripe.com/c/pay/wrong-days",
      pricing: { amountCents: 11900, interval: "month", softwareDays: 31, maximumConnectedAccounts: 5 },
    }),
    response({
      ok: true, url: "https://checkout.stripe.com/c/pay/wrong-account-limit",
      pricing: { amountCents: 11900, interval: "month", softwareDays: 30, maximumConnectedAccounts: 6 },
    }),
  ];
  const ctx = await page("unleashed/index.html", response(goodOptions), {
    bundle: () => replies.shift(),
  });
  try {
    const monthly = choose(ctx.dom, "monthly");
    monthly.link.dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.deepEqual(ctx.navigations, []);
    assert.equal(monthly.link.getAttribute("aria-disabled"), "false");
    monthly.link.dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.deepEqual(ctx.navigations, []);
    assert.equal(monthly.link.getAttribute("aria-disabled"), "false");
  } finally { ctx.dom.window.close(); }
});

test("a hung bundle request times out and restores the same retryable button", async () => {
  const ctx = await page("unleashed/index.html", response(goodOptions), {
    bundle: (_body, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  const { dom } = ctx;
  try {
    dom.window.document.body.setAttribute("data-hosting-checkout-timeout-ms", "10");
    const monthly = choose(dom, "monthly");
    monthly.link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await settle();
    assert.equal(monthly.link.getAttribute("aria-disabled"), "false");
    assert.match(monthly.card.querySelector("[data-hosting-card-status]").textContent, /could not be opened/);
  } finally { dom.window.close(); }
});

test("a stalled JSON body is covered by the checkout deadline", async () => {
  const ctx = await page("unleashed/index.html", response(goodOptions), {
    bundle: (_body, init) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    }),
  });
  try {
    ctx.dom.window.document.body.setAttribute("data-hosting-checkout-timeout-ms", "10");
    const monthly = choose(ctx.dom, "monthly");
    monthly.link.dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await settle();
    assert.equal(monthly.link.getAttribute("aria-disabled"), "false");
    assert.match(monthly.card.querySelector("[data-hosting-card-status]").textContent, /could not be opened/);
  } finally { ctx.dom.window.close(); }
});

test("missing price truth, disabled bundles and non-2xx options fail closed without a stuck status", async () => {
  const missing = await page("unleashed/index.html", response({ ...goodOptions, monthlyPriceLabel: "" }));
  try {
    assert.ok([...missing.dom.window.document.querySelectorAll("[data-hosting-select]")].every((box) => box.disabled));
    assert.match(missing.dom.window.document.querySelector("[data-hosting-selection-status]").textContent, /not available/);
  } finally { missing.dom.window.close(); }

  const missingLimit = await page("unleashed/index.html", response({ ...goodOptions, maximumConnectedAccounts: null }));
  try {
    assert.ok([...missingLimit.dom.window.document.querySelectorAll("[data-hosting-select]")].every((box) => box.disabled));
  } finally { missingLimit.dom.window.close(); }

  const unbundled = await page("unleashed/index.html", response({ ...goodOptions, bundleEnabled: false }));
  try {
    const boxes = [...unbundled.dom.window.document.querySelectorAll("[data-hosting-select]")];
    assert.deepEqual(boxes.map((box) => box.disabled), [true, true, false],
      "monthly/yearly wait for their atomic route while Lifetime retains separate hosting");
  } finally { unbundled.dom.window.close(); }

  const non2xx = await page("unleashed/index.html", response(null, false));
  try {
    assert.match(non2xx.dom.window.document.querySelector("[data-hosting-selection-status]").textContent, /could not be checked/);
  } finally { non2xx.dom.window.close(); }
});

test("thank-you copy distinguishes paid bundles from Lifetime's separate hosting confirmation", async () => {
  const yearly = await page("thanks/index.html", response(goodOptions), {
    remembered: { selected: true, plan: "yearly", at: Date.now() },
  });
  try {
    assert.equal(yearly.dom.window.document.querySelector("[data-hosting-combined-next]").hidden, false);
    assert.equal(yearly.dom.window.document.querySelector("[data-hosting-separate-next]").hidden, true);
  } finally { yearly.dom.window.close(); }

  const lifetime = await page("thanks/index.html", response(goodOptions), {
    remembered: { selected: true, plan: "lifetime", at: Date.now() },
  });
  try {
    assert.equal(lifetime.dom.window.document.querySelector("[data-hosting-combined-next]").hidden, true);
    assert.equal(lifetime.dom.window.document.querySelector("[data-hosting-separate-next]").hidden, false);
    assert.equal(lifetime.dom.window.document.querySelector("[data-hosting-confirm-price]").textContent, "$20.00/month");
  } finally { lifetime.dom.window.close(); }

  const unknown = await page("thanks/index.html", response(null, false), {
    remembered: { selected: true, plan: "yearly", at: Date.now() },
  });
  try {
    assert.equal(unknown.dom.window.document.querySelector("[data-hosting-combined-next]").hidden, true);
    assert.equal(unknown.dom.window.document.querySelector("[data-hosting-separate-next]").hidden, true);
  } finally { unknown.dom.window.close(); }
});
