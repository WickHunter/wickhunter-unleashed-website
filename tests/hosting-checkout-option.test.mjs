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
const response = (body, ok = true) => ({ ok, json: async () => body });
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

async function page(file, hostingResponse, { remembered = null, bundle = null } = {}) {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: `https://wickhunterunleashed.com/${file}`, runScripts: "outside-only" });
  const calls = [], navigations = [];
  let uuid = 0;
  Object.defineProperty(dom.window.crypto, "randomUUID", { value: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` });
  if (remembered) dom.window.localStorage.setItem("wh.hosting-choice.v1", JSON.stringify(remembered));
  dom.window.HTMLAnchorElement.prototype.click = function () { navigations.push(this.href); };
  dom.window.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/api/hosting/options")) return hostingResponse;
    if (String(url).includes("/api/hosting/bundle-checkout")) return bundle
      ? bundle(JSON.parse(init.body), init)
      : response(null, false);
    return response({ ok: true, plans: [] });
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
