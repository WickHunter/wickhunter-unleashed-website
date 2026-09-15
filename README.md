# Wick Hunter Software — marketing & checkout website

Static marketing site for Wick Hunter Software LLC. No build step — every
page is plain HTML, and `assets/site.css` / `assets/site.js` carry the shared
theme and behavior (mobile menu, FAQ accordion, exchange filter, Hub price
feed).

The visual theme (colors, radii, cards, buttons, pills, chips) is copied
verbatim from the Unleashed app itself, so the marketing site and the product
look like one thing.

## Two pages

- **`/` (`index.html`)** is the catalogue: every product and service the
  company sells, one card each (`#products`, which also serves as the
  `#services` anchor), the non-custodial money-flow explainer, and contact.
  Every "Buy Unleashed" control on this page — header, hero, product card —
  links to `/unleashed/#pricing`, never straight to checkout.
- **`/unleashed/` (`unleashed/index.html`)** is the flagship product's own
  page: the dashboard mockup, feature tiles, the five bot modules
  (`#bots`), the five exchanges (`#exchanges`), the install guide
  (`#install`), the three software licence plans plus optional managed hosting
  (`#pricing`), and the Unleashed FAQ (`#faq`). The three software plan cards
  link to Stripe checkout (`/buy?plan=...`). Managed hosting can be bundled
  into Monthly and Yearly checkout, or added as a separate monthly
  subscription to a Lifetime licence.

## Deploy on Netlify

1. Connect this repository in Netlify.
2. Publish directory: `.`
3. Build command: none (`netlify.toml` already sets `publish = "."`).
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
2. **Managed hosting.** Hosting can be bundled with Monthly or Yearly, or added
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
   pending and a 15-second deadline restores retry on a hung request. The
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

## Legal pages are drafts

`terms/`, `privacy/`, and `refunds/` each start with an HTML comment —
`<!-- DRAFT: have this reviewed before launch -->` — and end with a visible
draft notice. Have them reviewed by counsel before accepting real payments.
`terms/index.html` also has a governing-law placeholder (`State of [STATE],
USA`) that needs a real jurisdiction filled in.

## Structure

```
index.html            Home page — the product/service catalogue
unleashed/index.html  Wick Hunter Unleashed product page (features, bots,
                       exchanges, install guide, pricing, FAQ)
thanks/index.html     Stripe checkout success redirect target (noindex)
terms/index.html      Terms of Service (draft)
privacy/index.html    Privacy Policy (draft)
refunds/index.html    Refund policy (draft)
404.html              Static 404 fallback
assets/               Brand SVGs/PNGs + shared site.css / site.js
tests/                Browser-level checkout behavior verification
_headers              Security headers + caching
_redirects            /buy, /billing, and /customer → the Hub
netlify.toml          publish = "."
robots.txt            Crawling rules
sitemap.xml           /, /unleashed/, /terms/, /privacy/, /refunds/
```
