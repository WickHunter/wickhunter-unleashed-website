import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";

const siteJs = readFileSync(new URL("../assets/site.js", import.meta.url), "utf8");
const options = {
  ok: true, purchasable: true, priceIsProposed: false, combinedCheckoutEnabled: true,
  bundleEnabled: false, monthlyPriceLabel: "$20.00", planLabel: "Private VPS",
  regions: [{ label: "Japan" }], managedBackupsIncluded: false, maximumConnectedAccounts: 5,
};
const billing = {
  ok: true, mode: "live",
  launch: { active: true, hostingCheckoutEnabled: true,
    firstPaymentAtMs: Date.parse("2026-10-15T04:00:00Z"), redeemUntilMs: Date.parse("2026-10-16T04:00:00Z"), cryptoEnabled: true },
  plans: [
    { key: "monthly", amountCents: 9900 },
    { key: "yearly", amountCents: 69900, cryptoAvailable: true },
    { key: "lifetime", amountCents: 99900, cryptoAvailable: true },
  ],
};
const response = (body, ok = true) => ({ ok, status: ok ? 200 : 400, headers: { get: () => null }, json: async () => body });
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
async function page({ offer = billing, hosting = options, ref = "", checkout = null, orderDelay = 0 } = {}) {
  const html = readFileSync(new URL("../unleashed/index.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: `https://wickhunterunleashed.com/unleashed/${ref}`, runScripts: "outside-only" });
  dom.window.Date.now = () => Date.parse("2026-10-01T12:00:00Z");
  const calls = [], navigations = [];
  let uuid = 0;
  Object.defineProperty(dom.window.crypto, "randomUUID", { value: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` });
  dom.window.HTMLAnchorElement.prototype.click = function () { navigations.push(this.href); };
  dom.window.fetch = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (String(url).includes("/api/hosting/options")) {
      if (orderDelay) await new Promise(resolve => setTimeout(resolve, orderDelay));
      return response(hosting);
    }
    if (String(url).includes("/api/billing/plans")) return response(offer);
    if (String(url) === "/api/billing/checkout") return checkout ? checkout(JSON.parse(init.body), call) : response({ ok: true, url: "https://checkout.stripe.com/c/pay/six-plan" });
    return response({ ok: true });
  };
  dom.window.eval(siteJs);
  await settle();
  return { dom, calls, navigations };
}
function cardFor(dom, plan) { return dom.window.document.querySelector(`.pricing-card[data-plan="${plan}"]`); }
function selectHosting(dom, plan, selected = true) {
  const card = cardFor(dom, plan), box = card.querySelector("[data-hosting-select]");
  box.checked = selected;
  box.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  return { card, box, link: card.querySelector("[data-software-buy]") };
}
async function click(dom, link) {
  link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await settle();
}

test("all three hosted choices use one immediate mixed card checkout even without an active launch offer", async () => {
  const noOffer = { ...billing, launch: { ...billing.launch, active: false } };
  const ctx = await page({ offer: noOffer, ref: "?ref=REF-123" });
  try {
    for (const [plan, displayed, amount, label] of [
      ["monthly", "119", "11900", /\$119 due today, then monthly/],
      ["yearly", "939", "93900", /\$939 due today, then annually/],
      ["lifetime", "999", "101900", /\$20 VPS today, then monthly/],
    ]) {
      const chosen = selectHosting(ctx.dom, plan);
      assert.equal(chosen.box.disabled, false);
      assert.equal(chosen.card.querySelector("[data-plan-price]").textContent, displayed);
      assert.match(chosen.card.querySelector("[data-hosting-card-status]").textContent, label);
      assert.match(chosen.card.querySelector("[data-hosting-card-status]").textContent, /VPS plans bill immediately due to VPS provider fees/);
      assert.match(chosen.link.getAttribute("href"), new RegExp(`[?&]plan=${plan}(?:&|$)`));
      assert.match(chosen.link.getAttribute("href"), /[?&]hosting=true(?:&|$)/);
      assert.match(chosen.link.getAttribute("href"), /[?&]ref=REF-123(?:&|$)/);
      assert.equal(chosen.card.querySelector("[data-crypto-buy]")?.hidden ?? true, true, "mixed hosting has no crypto checkout");
      await click(ctx.dom, chosen.link);
      const call = ctx.calls.filter(c => c.url === "/api/billing/checkout").at(-1);
      assert.ok(call);
      const body = JSON.parse(call.init.body);
      assert.deepEqual({ plan: body.plan, payment: body.payment, hosting: body.hosting, referral: body.referral },
        { plan, payment: "card", hosting: true, referral: "REF-123" });
      assert.match(body.attemptId, /^[0-9a-f-]{36}$/i);
      assert.equal(ctx.navigations.at(-1), "https://checkout.stripe.com/c/pay/six-plan");
    }
    assert.equal(ctx.calls.some(c => c.url.includes("/api/hosting/bundle-checkout")), false);
  } finally { ctx.dom.window.close(); }
});

test("with an active software offer, selecting VPS replaces the free-period copy with immediate full billing", async () => {
  const ctx = await page();
  try {
    const hosted = selectHosting(ctx.dom, "monthly");
    assert.match(hosted.card.querySelector("[data-launch-terms]").textContent, /VPS plans bill immediately due to VPS provider fees/);
    assert.doesNotMatch(hosted.card.querySelector("[data-launch-terms]").textContent, /\$0 today/);
    assert.match(ctx.dom.window.document.querySelector("[data-launch-free-copy]").textContent, /hosted plan is charged in full today/i);
    assert.match(ctx.dom.window.document.querySelector("[data-hosting-selection-status]").textContent, /VPS plans bill immediately due to VPS provider fees/);
  } finally { ctx.dom.window.close(); }
});

test("software-only launch preserves the Oct 15 software date and normal crypto choices", async () => {
  const ctx = await page();
  try {
    const monthly = cardFor(ctx.dom, "monthly");
    assert.match(monthly.querySelector("[data-launch-terms]").textContent, /\$0 today; first monthly charge on Oct 15/);
    await click(ctx.dom, monthly.querySelector("[data-software-buy]"));
    const body = JSON.parse(ctx.calls.filter(c => c.url === "/api/billing/checkout").at(-1).init.body);
    assert.equal(body.hosting, undefined);
    assert.equal(body.plan, "monthly");
    assert.equal(body.payment, "card");

    const yearly = cardFor(ctx.dom, "yearly");
    assert.equal(yearly.querySelector("[data-crypto-buy]").hidden, false);
    await click(ctx.dom, yearly.querySelector("[data-crypto-buy]"));
    const cryptoBody = JSON.parse(ctx.calls.filter(c => c.url === "/api/billing/checkout").at(-1).init.body);
    assert.equal(cryptoBody.payment, "crypto");
    assert.equal(cryptoBody.hosting, undefined);
  } finally { ctx.dom.window.close(); }
});

test("hosting remains disabled unless launch and options endpoints both confirm readiness", async () => {
  for (const [offer, hosting] of [
    [{ ...billing, launch: { ...billing.launch, hostingCheckoutEnabled: false } }, options],
    [billing, { ...options, combinedCheckoutEnabled: false, bundleEnabled: true }],
    [billing, { ...options, purchasable: false }],
    [billing, { ...options, priceIsProposed: true }],
  ]) {
    const ctx = await page({ offer, hosting });
    try {
      assert.ok([...ctx.dom.window.document.querySelectorAll("[data-hosting-select]")].every(box => box.disabled));
      assert.match(ctx.dom.window.document.querySelector("[data-hosting-selection-status]").textContent, /not available/i);
    } finally { ctx.dom.window.close(); }
  }
});

test("readiness works whichever endpoint responds first", async () => {
  const ctx = await page({ orderDelay: 10 });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    await settle();
    assert.ok([...ctx.dom.window.document.querySelectorAll("[data-hosting-select]")].every(box => !box.disabled));
  } finally { ctx.dom.window.close(); }
});

test("combined checkout retries with the same versioned attempt id and separates software identity", async () => {
  const bodies = [];
  const ctx = await page({ checkout: body => {
    bodies.push(body);
    return response({ ok: false, error: "temporary" }, false);
  } });
  try {
    const hosted = selectHosting(ctx.dom, "monthly");
    await click(ctx.dom, hosted.link);
    assert.equal(hosted.link.getAttribute("aria-disabled"), "false");
    await click(ctx.dom, hosted.link);
    assert.equal(bodies[0].attemptId, bodies[1].attemptId);
    selectHosting(ctx.dom, "monthly", false);
    const software = cardFor(ctx.dom, "monthly");
    assert.doesNotMatch(software.querySelector("[data-software-buy]").getAttribute("href"), /[?&]hosting=true(?:&|$)/);
    await click(ctx.dom, software.querySelector("[data-software-buy]"));
    assert.notEqual(bodies[1].attemptId, bodies[2].attemptId);
    assert.match(bodies[1].attemptId, /^[0-9a-f-]{36}$/i);
  } finally { ctx.dom.window.close(); }
});

test("an invalid checkout URL is refused and leaves the choice retryable", async () => {
  const urls = [
    "https://evil.example/pay",
    "https://attacker@checkout.stripe.com/c/pay/forged",
    "https://checkout.stripe.com/c/pay/token#untrusted",
  ];
  const ctx = await page({ checkout: () => response({ ok: true, url: urls.shift() }) });
  try {
    const selected = selectHosting(ctx.dom, "yearly");
    for (let i = 0; i < 3; i++) {
      await click(ctx.dom, selected.link);
      assert.deepEqual(ctx.navigations, []);
      assert.equal(selected.link.getAttribute("aria-disabled"), "false");
      assert.match(selected.card.querySelector("[data-hosting-card-status]").textContent, /could not be opened/);
    }
  } finally { ctx.dom.window.close(); }
});

test("a confirmed invalid referral retries without referral but preserves the VPS selection", async () => {
  const bodies = [];
  const ctx = await page({ ref: "?ref=REF-123", checkout: body => {
    bodies.push(body);
    return bodies.length === 1
      ? response({ ok: false, error: "Referral discount is not active" }, false)
      : response({ ok: true, url: "https://checkout.stripe.com/c/pay/no-ref" });
  } });
  try {
    const hosted = selectHosting(ctx.dom, "yearly");
    await click(ctx.dom, hosted.link);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].referral, "REF-123");
    assert.equal(bodies[0].hosting, true);
    assert.equal(bodies[1].referral, undefined);
    assert.equal(bodies[1].hosting, true);
    assert.notEqual(bodies[0].attemptId, bodies[1].attemptId);
    assert.equal(ctx.navigations.at(-1), "https://checkout.stripe.com/c/pay/no-ref");
  } finally { ctx.dom.window.close(); }
});

test("429 is retryable with the server delay and does not create a second in-flight request", async () => {
  let resolveCheckout;
  let attempts = 0;
  const bodies = [];
  const ctx = await page({ checkout: body => {
    bodies.push(body); attempts++;
    if (attempts === 1) return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({ retryAfterSeconds: 121 }) };
    return new Promise(resolve => { resolveCheckout = resolve; });
  } });
  try {
    const hosted = selectHosting(ctx.dom, "monthly");
    await click(ctx.dom, hosted.link);
    assert.match(hosted.card.querySelector("[data-hosting-card-status]").textContent, /wait 3 minutes/);
    hosted.link.dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    hosted.link.dispatchEvent(new ctx.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.equal(attempts, 2, "a pending request suppresses duplicate submissions");
    assert.equal(bodies[0].attemptId, bodies[1].attemptId, "explicit retry reuses the same idempotency key");
    resolveCheckout(response({ ok: true, url: "https://checkout.stripe.com/c/pay/retry-after-limit" }));
    await settle();
    assert.equal(ctx.navigations.at(-1), "https://checkout.stripe.com/c/pay/retry-after-limit");
  } finally { resolveCheckout?.(response({ ok: false }, false)); ctx.dom.window.close(); }
});

test("a timed-out mixed checkout restores the button and retries with the same attempt id", async () => {
  const bodies = [];
  const ctx = await page({ checkout: (body, call) => {
    bodies.push(body);
    if (bodies.length === 1) return new Promise((_resolve, reject) => {
      call.init.signal.addEventListener("abort", () => reject(new Error("timed out")), { once: true });
    });
    return response({ ok: false, error: "temporary" }, false);
  } });
  try {
    ctx.dom.window.document.body.setAttribute("data-launch-checkout-timeout-ms", "10");
    const hosted = selectHosting(ctx.dom, "yearly");
    await click(ctx.dom, hosted.link);
    await new Promise(resolve => setTimeout(resolve, 20));
    await settle();
    assert.equal(hosted.link.getAttribute("aria-disabled"), "false");
    assert.match(hosted.card.querySelector("[data-hosting-card-status]").textContent, /could not be opened/);
    await click(ctx.dom, hosted.link);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].attemptId, bodies[1].attemptId);
    assert.deepEqual(ctx.navigations, []);
  } finally { ctx.dom.window.close(); }
});
