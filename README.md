# Wick Hunter Software — marketing & checkout website

Static marketing site for Wick Hunter Software LLC. Every page is plain HTML, and `assets/site.css` / `assets/site.js` carry the shared
theme and behavior (mobile menu, FAQ accordion, exchange filter, Hub price
feed).

The visual theme (colors, radii, cards, buttons, pills, chips) is copied
verbatim from the Unleashed app itself, so the marketing site and the product
look like one thing.

## Sales pages

- `/` introduces Unleashed and Hedge Bots, using screenshots rendered from the shipped app with clearly labeled illustrative data. It keeps consulting services in the footer and directs the main action to plans.
- `/unleashed/` explains Hedge Bots, the five bot modules, plan options, hosting, setup and exchange support. Existing Stripe checkout, referral, account and support integrations remain in `assets/site.js`.
- The free software period and signup starter-pack panels use the Hub's verified live offer status. The free card period ends at the start of October 15; the starter signup deadline ends at the end of October 15 Eastern Time. Public pages show base prices and no private promotion code.
- `assets/marketing.css` styles the homepage; `assets/product-marketing.css` styles the product page. Product image labels distinguish sample data from trading results. The community link uses the owner's Discord invite.

## Deploy on Netlify

1. Connect this repository in Netlify.
2. Publish directory: `dist`.
3. Build command: `node scripts/build-site.mjs` (configured in `netlify.toml`). The build copies only public pages and assets; tests and internal repository files are excluded.
4. Point the custom domain (`wickhunterunleashed.com`) at the Netlify site.

`_redirects` sends `/buy`, `/billing`, and `/customer` to the Hub (the source
of truth for checkout, billing, and managed-hosting eligibility); `_headers`
sets security headers and long-lived caching for `/assets/*`.

## Pricing and Hub integration

1. **Software licence prices.** There are three plans — Monthly, Yearly, Lifetime — each
   its own card in the `#pricing` block in `unleashed/index.html`. Prices are
   fixed text baked directly into that markup — no body attribute, no JS
   fill (a `data-hub` fetch on page load overwrites the number with the
   Hub's live price if it's reachable; the baked-in text is the fallback).
   Changing a price is a one-line edit to the `.price` span in the relevant
   card, plus the matching change in Stripe/the Hub (the price or product
   the plan's Buy link resolves to) — otherwise the site and checkout will
   disagree. The three Buy links are:
   - Monthly → `/buy?plan=monthly`
   - Yearly → `/buy?plan=yearly`
   - Lifetime → `/buy?plan=lifetime`

   `_redirects` sends `/buy` to the Hub and passes the `?plan=` query
   through untouched, so the Hub is what maps `plan=` to the right Stripe
   price.
2. **Managed hosting.** Monthly and Yearly plus VPS use one combined checkout
   and one subscription, including during the launch offer. Both software and
   VPS are free until October 15, 2026 at 00:00 Eastern Time; renewals are
   $119/month or $939/year ($699 software plus $240 annual hosting).
   Lifetime retains the `launch.hostingCheckoutEnabled` handoff: it sends
   `hosting:true` to `/api/billing/checkout` and automatically returns to the Hub's
   `/checkout/hosting` page, which verifies settlement and webhook fulfillment
   before opening the separate $20/month hosting subscription checkout. Hosting
   charges immediately on confirmation. Lifetime software remains one-time.
   Checkout retry identities include the VPS selection. The continuation secret
   stays in the return URL fragment and only authorizes this hosting checkout.

   Hosting can be bundled with Monthly or Yearly, or added
   separately to Lifetime. The site reads the current plan, regions, backup coverage, price,
   and availability from the Hub's public `/api/hosting/options` response so
   the Hub configuration remains the source of truth. The Hub also owns
   eligibility, one-instance enforcement, checkout, provisioning, and
   customer email. Each licence card has its own availability-gated hosting
   checkbox. Monthly shows one $119 monthly software + hosting renewal; Yearly
   shows one $939 annual renewal ($699 software + $240 hosting); Lifetime keeps
   its $999 one-time software price and leads to a separately confirmed $20
   monthly hosting subscription.

   Checked Monthly and Yearly cards POST `{plan, checkoutAttemptId}` to
   `/api/hosting/bundle-checkout`. The browser persists one random UUID for the
   current plan/attempt so an ambiguous response can be retried idempotently,
   validates the returned amount/interval and an HTTPS `checkout.stripe.com`
   URL, then navigates. The button remains disabled only while the request is
   pending and a 30-second deadline restores retry on a hung request. Provider
   outages have a specific retryable message without submitting payment. The
   checkboxes stay disabled until `/api/hosting/options` reports a final price,
   purchasability, `maximumConnectedAccounts`, and `bundleEnabled:true`;
   Lifetime's separate path needs the final hosting price and purchasability
   but not the bundle flag.

3. **The Hub redirect targets**, if the Hub ever moves off the bare IP
   `45.76.105.174` onto its own domain — update the two lines in
   `_redirects`.

## Focused checkout verification

Run `node --test tests/hosting-checkout-option.test.mjs`. The jsdom suite drives
all three card selections, exact $119/month and $939/year bundle totals,
Lifetime's separate $20/month follow-up, idempotent retry, plan changes,
request timeout recovery, response price/interval checks, Stripe URL validation,
and unavailable-option states without making a network request.

## Customer policies

`terms/`, `privacy/`, and `refunds/` contain the September 30, 2026 policies for Wick Hunter Software, LLC, a Delaware LLC. They include the business address, October 15 software launch offer, seven-day first-payment refund request window, one-time crypto purchases, and automatic technical token renewal for Lifetime access. Keep checkout disclosures and these policies aligned when commercial terms change.

## Structure

```
index.html            Home page — Unleashed and Hedge Bot sales overview
unleashed/index.html  Wick Hunter Unleashed product page (features, bots,
                       exchanges, install guide, pricing, FAQ)
thanks/index.html     Stripe checkout success redirect target (noindex)
terms/index.html      Terms of Service
privacy/index.html    Privacy Policy
refunds/index.html    Refund policy
404.html              Static 404 fallback
assets/               Brand SVGs/PNGs + shared site.css / site.js
tests/                Browser-level checkout behavior verification
_headers              Security headers + caching
_redirects            /buy, /billing, and /customer → the Hub
netlify.toml          public-only build into dist/
robots.txt            Crawling rules
sitemap.xml           /, /unleashed/, /terms/, /privacy/, /refunds/
```

## Support chat

The floating support button and footer links open an on-page chat panel, with
close/Escape controls and a layout that fits mobile screens. The conversation
stays loaded when the panel closes. `/support/*` proxies the Hub on the website
origin so Secure, SameSite session cookies work without third-party cookies.
The Hub still validates the website origin and support-action header. No
credentials are stored in site JavaScript. Existing `/support/` bookmarks open
the full chat. The support button retains readable text in every link state.
